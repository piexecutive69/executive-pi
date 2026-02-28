import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { formatIDR } from '../lib/format'
import SeoMeta from '../components/SeoMeta'

function normalizeMsisdn(value) {
  const raw = String(value || '').replace(/\D/g, '')
  if (raw.startsWith('62')) return `0${raw.slice(2)}`
  return raw
}

function detectOperator(msisdn) {
  const num = normalizeMsisdn(msisdn)
  if (num.length < 4) return null
  const p4 = num.slice(0, 4)

  const groups = [
    { operator: 'Telkomsel', brands: ['TELKOMSEL'], prefixes: ['0811', '0812', '0813', '0821', '0822', '0852', '0853', '0851'] },
    { operator: 'Indosat', brands: ['INDOSAT'], prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'] },
    { operator: 'XL', brands: ['XL'], prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'] },
    { operator: 'AXIS', brands: ['AXIS'], prefixes: ['0838', '0831', '0832', '0833'] },
    { operator: 'Tri', brands: ['TRI', 'THREE'], prefixes: ['0895', '0896', '0897', '0898', '0899'] },
    { operator: 'Smartfren', brands: ['SMARTFREN'], prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'] },
  ]

  return groups.find((item) => item.prefixes.includes(p4)) || null
}

export default function PpobPrepaidPurchasePage({ userId }) {
  const navigate = useNavigate()
  const { categoryName } = useParams()
  const decodedCategory = decodeURIComponent(categoryName || '')
  const [allItems, setAllItems] = useState([])
  const [services, setServices] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [customerRef, setCustomerRef] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [walletBalance, setWalletBalance] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [productData, serviceData] = await Promise.all([
          api.listDigiflazzProducts({ type: 'prepaid', userId: userId || null, category: decodedCategory, limit: 200 }),
          api.listPpobServices(),
        ])
        if (!active) return
        setAllItems(productData.items || [])
        setServices(serviceData || [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat produk prabayar.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [decodedCategory])

  const isPhoneBasedCategory = useMemo(() => {
    const c = String(decodedCategory || '').toLowerCase()
    return c.includes('pulsa') || c.includes('data') || c.includes('sms')
  }, [decodedCategory])

  const operator = useMemo(() => detectOperator(customerRef), [customerRef])
  const normalizedCustomerRef = useMemo(() => normalizeMsisdn(customerRef), [customerRef])
  const isMin8Digits = normalizedCustomerRef.length >= 8

  const availableBrands = useMemo(
    () => [...new Set(allItems.map((item) => String(item.brand || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [allItems],
  )

  const filteredItems = useMemo(() => {
    if (isPhoneBasedCategory) {
      if (!operator) return []
      return allItems.filter((item) => {
        const brand = String(item.brand || '').toUpperCase()
        return operator.brands.some((b) => brand.includes(b))
      })
    }
    if (!selectedBrand) return []
    return allItems.filter((item) => String(item.brand || '').trim() === selectedBrand)
  }, [allItems, operator, isPhoneBasedCategory, selectedBrand])

  const defaultServiceId = useMemo(() => {
    if (!services.length) return null
    const net = services.find((svc) => String(svc.code || '').toUpperCase() === 'NET')
    return Number((net || services[0]).id)
  }, [services])

  const priceIdr = Number(quote?.pricing?.amountIdr || selectedItem?.price_base_idr || 0)
  const adminFeeIdr = Number(quote?.pricing?.adminFeeIdr || 0)
  const totalIdr = Number(quote?.pricing?.totalIdr || priceIdr + adminFeeIdr)
  const balanceIdr = Number(walletBalance?.idr_balance || 0)
  const isLoggedIn = Boolean(userId)
  const isBalanceEnough = isLoggedIn && balanceIdr >= totalIdr

  const openConfirm = async (itemOverride = null) => {
    const chosenItem = itemOverride || selectedItem
    if (!chosenItem || !customerRef) {
      setError('Masukkan nomor dan pilih produk.')
      return
    }
    if (isPhoneBasedCategory && !operator) {
      setError('Nomor tidak dikenali operatornya.')
      return
    }
    if (!defaultServiceId) {
      setError('Service PPOB belum tersedia.')
      return
    }
    setError('')
    setMessage('')
    setQuote(null)
    setSelectedItem(chosenItem)
    setConfirmOpen(true)

    setQuoteLoading(true)
    try {
      const pricing = await api.previewPpobPricing({
        userId: userId || null,
        serviceId: defaultServiceId,
        amountIdr: Number(chosenItem.price_base_idr || 0),
        productType: 'prepaid',
        productCode: chosenItem.buyer_sku_code,
      })
      setQuote(pricing)
    } catch (err) {
      setError(err.message || 'Gagal memuat preview harga.')
    } finally {
      setQuoteLoading(false)
    }

    if (!userId) return
    setWalletLoading(true)
    try {
      const wallet = await api.getWalletBalance(userId)
      setWalletBalance(wallet)
    } catch (err) {
      setError(err.message || 'Gagal memuat saldo wallet.')
    } finally {
      setWalletLoading(false)
    }
  }

  const buy = async () => {
    if (!selectedItem || !customerRef) {
      setError('Masukkan nomor dan pilih produk.')
      return
    }
    if (isPhoneBasedCategory && !operator) {
      setError('Nomor tidak dikenali operatornya.')
      return
    }
    if (!userId) {
      setError('Login dulu di tab Profile untuk lanjut pembayaran.')
      return
    }
    if (!defaultServiceId) {
      setError('Service PPOB belum tersedia.')
      return
    }
    if (!quote) {
      setError('Preview harga belum tersedia.')
      return
    }
    if (!isBalanceEnough) {
      setError('Saldo IDR tidak cukup untuk transaksi ini.')
      return
    }

    setError('')
    setMessage('')
    setProcessing(true)
    try {
      const tx = await api.createPpobTransaction({
        userId,
        serviceId: defaultServiceId,
        customerRef: normalizeMsisdn(customerRef),
        amountIdr: Number(selectedItem.price_base_idr || 0),
        productType: 'prepaid',
        productCode: selectedItem.buyer_sku_code,
      })
      setMessage(`Transaksi berhasil. ID #${tx.id}`)
      setConfirmOpen(false)
      const wallet = await api.getWalletBalance(userId)
      setWalletBalance(wallet)
    } catch (err) {
      setError(err.message || 'Transaksi gagal.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="pb-20">
      <SeoMeta title={`Prabayar ${decodedCategory}`} description={`Pembelian produk prabayar kategori ${decodedCategory}.`} />
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => navigate('/ppob')} className="grid h-7 w-7 cursor-pointer place-items-center text-[#c4d3f2]" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-[17px] font-medium text-[#e3ebfb]">{decodedCategory}</h2>
      </div>

      {loading ? <p className="mb-3 text-[12px] text-[#8ea6d7]">Memuat produk...</p> : null}
      {error ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}
      {message ? <p className="mb-3 rounded-md border border-[#6e8dc8]/30 bg-[#162a57] p-2 text-[12px] text-[#c4d3f2]">{message}</p> : null}

      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
        <p className="mb-2 text-[11px] text-[#8ea6d7]">Nomor tujuan</p>
        <input
          value={customerRef}
          onChange={(e) => setCustomerRef(e.target.value)}
          placeholder={isPhoneBasedCategory ? 'Contoh: 0812xxxxxxxx' : 'Masukkan ID / nomor pelanggan'}
          className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
        />
        {isPhoneBasedCategory && operator ? <p className="mt-2 text-[12px] font-medium text-[#9fd0ff]">{operator.operator}</p> : null}
      </div>

      {!isPhoneBasedCategory && isMin8Digits ? (
        <div className="mt-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <p className="mb-2 text-[11px] text-[#8ea6d7]">Pilih provider</p>
          <div className="flex flex-wrap gap-2">
            {availableBrands.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => setSelectedBrand(brand)}
                className={`rounded-full border px-3 py-1 text-[11px] ${
                  selectedBrand === brand
                    ? 'border-[#9fb4df]/40 bg-[#1b3368] text-[#e3ebfb]'
                    : 'border-[#6e8dc8]/25 bg-[#162a57] text-[#8ea6d7]'
                }`}
              >
                {brand}
              </button>
            ))}
            {!availableBrands.length ? <p className="text-[12px] text-[#8ea6d7]">Provider tidak tersedia.</p> : null}
          </div>
        </div>
      ) : null}
      {(isPhoneBasedCategory ? Boolean(operator) : isMin8Digits && Boolean(selectedBrand)) ? (
        <div className="mt-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openConfirm(item)}
                className={`w-full rounded-[10px] border px-3 py-2 text-left ${
                  selectedItem?.id === item.id ? 'border-[#9fb4df]/40 bg-[#1b3368]' : 'border-[#6e8dc8]/25 bg-[#162a57]'
                }`}
              >
                <p className="text-[12px] font-medium text-[#e3ebfb]">{item.product_name}</p>
                <p className="text-[11px] text-[#8ea6d7]">{item.desc_text || '-'}</p>
                <p className="text-[11px] text-[#9fd0ff]">{formatIDR(item.final_price_idr ?? item.price_base_idr)}</p>
              </button>
            ))}
            {!filteredItems.length ? (
              <p className="text-[12px] text-[#8ea6d7]">
                {isPhoneBasedCategory ? 'Tidak ada produk yang cocok dengan operator.' : 'Tidak ada produk untuk provider ini.'}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity ${confirmOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setConfirmOpen(false)}
      />
      <aside
        className={`fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] rounded-t-2xl border border-[#6e8dc8]/30 bg-[#0f1d3f] p-4 shadow-[0_-8px_24px_rgba(0,0,0,.4)] transition-transform ${confirmOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <p className="text-[14px] font-medium text-[#e3ebfb]">Konfirmasi Pembelian</p>
        <div className="mt-2 space-y-1 text-[12px] text-[#8ea6d7]">
          <p>
            Nomor: <span className="text-[#c4d3f2]">{normalizeMsisdn(customerRef) || '-'}</span>
          </p>
          <p>
            Produk: <span className="text-[#c4d3f2]">{selectedItem?.product_name || '-'}</span>
          </p>
          <p>
            Harga: <span className="text-[#9fd0ff]">{formatIDR(priceIdr)}</span>
          </p>
          <p>
            Admin: <span className="text-[#9fd0ff]">{formatIDR(adminFeeIdr)}</span>
          </p>
          <p>
            Total: <span className="text-[#9fd0ff]">{formatIDR(totalIdr)}</span>
          </p>
        </div>
        {quoteLoading ? <p className="mt-2 text-[11px] text-[#8ea6d7]">Menghitung harga...</p> : null}
        {quote?.membership?.code ? (
          <p className="mt-1 text-[11px] text-[#8ea6d7]">
            Level harga: <span className="text-[#c4d3f2]">{quote.membership.code}</span>
          </p>
        ) : null}

        <div className="mt-3 rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-3 py-2 text-[12px]">
          {!isLoggedIn ? (
            <p className="text-amber-200">Status login: belum login.</p>
          ) : walletLoading ? (
            <p className="text-[#8ea6d7]">Mengecek saldo...</p>
          ) : (
            <>
              <p className="text-[#8ea6d7]">
                Saldo IDR: <span className="text-[#c4d3f2]">{formatIDR(balanceIdr)}</span>
              </p>
              <p className={isBalanceEnough ? 'text-emerald-300' : 'text-red-300'}>
                {isBalanceEnough ? 'Saldo cukup' : 'Saldo tidak cukup'}
              </p>
            </>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-[#6e8dc8]/35 bg-[#162a57] py-2 text-[12px] text-[#c4d3f2]">
            Batal
          </button>
          {!isLoggedIn ? (
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb]"
            >
              Login Dulu
            </button>
          ) : (
            <button
              type="button"
              onClick={buy}
              disabled={!quote || quoteLoading || !isBalanceEnough || processing}
              className="rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-60"
            >
              {processing ? 'Memproses...' : 'Konfirmasi Bayar'}
            </button>
          )}
        </div>
      </aside>
    </section>
  )
}
