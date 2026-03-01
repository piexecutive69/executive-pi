import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { api } from '../lib/api'
import { formatIDR, formatPi } from '../lib/format'
import SeoMeta from '../components/SeoMeta'
import LoginRequiredCard from '../components/LoginRequiredCard'
import { authenticateWithPiSdk, getPiSdkSession, savePiSdkSession } from '../lib/piSdk'

export default function CartPage({ userId, onRefreshUser, onCartChanged }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadCart = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getCart(userId)
      setItems(data.items || [])
      if (onCartChanged) onCartChanged(userId)
    } catch (err) {
      setError(err.message || 'Gagal memuat keranjang.')
    } finally {
      setLoading(false)
    }
  }, [onCartChanged, userId])

  useEffect(() => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }
    loadCart()
  }, [loadCart])

  const summary = useMemo(() => {
    const subtotalIdr = items.reduce((sum, item) => sum + Number(item.price_idr) * Number(item.qty), 0)
    const subtotalPi = items.reduce((sum, item) => sum + Number(item.price_pi) * Number(item.qty), 0)
    return {
      subtotalIdr,
      subtotalPi,
      totalIdr: subtotalIdr,
    }
  }, [items])

  const setQty = async (item, step) => {
    const nextQty = Math.max(1, Number(item.qty) + step)
    if (nextQty === Number(item.qty)) return
    setError('')
    try {
      await api.updateCartItem({ itemId: item.id, userId, qty: nextQty })
      await loadCart()
    } catch (err) {
      setError(err.message || 'Gagal update quantity.')
    }
  }

  const removeItem = async (itemId) => {
    setError('')
    try {
      await api.deleteCartItem({ itemId, userId })
      await loadCart()
    } catch (err) {
      setError(err.message || 'Gagal menghapus item.')
    }
  }

  const checkout = async (paymentMethod) => {
    setSubmitting(true)
    setMessage('')
    setError('')
    try {
      if (paymentMethod === 'pi_sdk') {
        let piSession = getPiSdkSession()
        if (!piSession?.accessToken) {
          piSession = await authenticateWithPiSdk()
        }

        const syncedUser = await api.syncPiBalance(userId, {
          accessToken: piSession.accessToken,
          uid: piSession.uid || null,
          username: piSession.username || null,
          walletAddress: piSession.walletAddress || null,
          walletSecretId: piSession.walletSecretId || null,
        })

        const nextPiSession = {
          ...piSession,
          username: syncedUser?.pi_auth?.username || piSession.username || null,
          walletAddress: syncedUser?.pi_auth?.walletAddress || piSession.walletAddress || null,
          walletSecretId: syncedUser?.pi_auth?.walletSecretId || piSession.walletSecretId || null,
          piBalance: Number(syncedUser?.pi_auth?.piBalance ?? syncedUser?.pi_balance ?? piSession.piBalance ?? 0),
          accessToken: piSession.accessToken || null,
          authenticatedAt: Date.now(),
        }
        savePiSdkSession(nextPiSession)
        if (onRefreshUser) onRefreshUser(syncedUser)
      }

      const data = await api.checkout({
        userId,
        paymentMethod,
        shippingAddress: 'Alamat pelanggan - PI Store',
      })
      setMessage(`Checkout berhasil. Order #${data.orderId}`)
      if (paymentMethod === 'pi_sdk') {
        toast.info('Pembayaran Pi saat ini menggunakan saldo Pi tersimpan di backend (belum on-chain transfer).')
      }
      if (data.payment?.paymentUrl) {
        window.open(data.payment.paymentUrl, '_blank', 'noopener,noreferrer')
      }
      await loadCart()
      if (onRefreshUser) {
        const user = await api.getUser(userId)
        onRefreshUser(user)
      }
    } catch (err) {
      setError(err.message || 'Checkout gagal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pb-20">
      <SeoMeta title="Shopping Cart" description="Review keranjang belanja dan lanjutkan ke proses checkout." />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Shopping Cart</h2>

      {!userId ? <LoginRequiredCard /> : null}
      {!userId ? null : (
        <>
          {loading ? <p className="mb-3 text-[12px] text-[#8ea6d7]">Memuat keranjang...</p> : null}
          {error ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}
          {message ? <p className="mb-3 rounded-md border border-[#6e8dc8]/30 bg-[#162a57] p-2 text-[12px] text-[#c4d3f2]">{message}</p> : null}

          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-2 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
                <div className="flex gap-2">
                  <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-[4px] bg-[#162a57]">
                    <img src={item.image_url} alt={item.name} className="max-h-[70px] w-auto object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-[15px] font-medium leading-tight text-[#e3ebfb]">{item.name}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[12px]">
                        <p className="font-medium text-[#9fd0ff]">{formatIDR(item.price_idr)}</p>
                        <p className="text-[#74b8ff]">{formatPi(item.price_pi)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-[#6e8dc8]/35 px-2 py-1 text-[#c4d3f2]">
                          <button type="button" className="text-[15px]" onClick={() => setQty(item, -1)}>
                            -
                          </button>
                          <span className="min-w-4 text-center text-[13px]">{item.qty}</span>
                          <button type="button" className="text-[15px]" onClick={() => setQty(item, 1)}>
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="grid h-7 w-7 place-items-center rounded-full border border-red-300/25 bg-red-400/10 text-red-200"
                          aria-label="Hapus item"
                          title="Hapus item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!loading && !items.length ? <p className="text-[12px] text-[#8ea6d7]">Keranjang masih kosong.</p> : null}

          <div className="mt-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
            <h3 className="mb-2 text-[15px] font-medium text-[#e3ebfb]">Checkout Summary</h3>
            <div className="space-y-1 text-[12px] text-[#8ea6d7]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {formatIDR(summary.subtotalIdr)} | {formatPi(summary.subtotalPi)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-[#6e8dc8]/25 pt-2 text-[13px] font-medium text-[#e3ebfb]">
                <span>Total</span>
                <span>{formatIDR(summary.totalIdr)}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting || !items.length}
                onClick={() => checkout('wallet_idr')}
                className="rounded-full bg-[#274786] py-2 text-[13px] font-medium text-[#e3ebfb] disabled:opacity-60"
              >
                Saldo IDR
              </button>
              <button
                type="button"
                disabled={submitting || !items.length}
                onClick={() => checkout('pi_sdk')}
                className="rounded-full border border-[#6e8dc8]/35 bg-[#162a57] py-2 text-[13px] font-medium text-[#e3ebfb] disabled:opacity-60"
              >
                Pi SDK
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
