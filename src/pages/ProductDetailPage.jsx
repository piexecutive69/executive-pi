import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Minus, Plus, Star, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { formatIDR, formatPi } from '../lib/format'
import SeoMeta from '../components/SeoMeta'
import LoginRequiredCard from '../components/LoginRequiredCard'

const LOGIN_CART_MESSAGE = 'Login dulu di tab Profile sebelum tambah ke keranjang.'
const ADD_CART_SUCCESS_MESSAGE = 'Produk ditambahkan ke keranjang.'

export default function ProductDetailPage({ products, userId }) {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  const [remoteProduct, setRemoteProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showLoginRequired, setShowLoginRequired] = useState(false)

  const product = useMemo(() => {
    const fromList = products.find((p) => String(p.id) === String(productId))
    return fromList || remoteProduct
  }, [products, productId, remoteProduct])

  useEffect(() => {
    if (products.some((p) => String(p.id) === String(productId))) return
    let active = true

    async function loadProduct() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await api.getProduct(productId)
        if (!active) return
        setRemoteProduct(data)
      } catch (err) {
        if (!active) return
        setLoadError(err.message || 'Gagal memuat produk.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProduct()
    return () => {
      active = false
    }
  }, [productId, products])

  const addToCart = async () => {
    if (!product) return
    if (!userId) {
      setActionError(LOGIN_CART_MESSAGE)
      setShowLoginRequired(true)
      return
    }
    setSubmitting(true)
    setFeedback('')
    setActionError('')
    try {
      await api.addCartItem({ userId, productId: Number(product.id), qty })
      setFeedback(ADD_CART_SUCCESS_MESSAGE)
    } catch (err) {
      setActionError(err.message || 'Gagal menambahkan ke keranjang.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !product) {
    return (
      <section className="pb-20">
        <SeoMeta title="Memuat Produk" description="Memuat detail produk." />
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-4 text-[#c4d3f2]">Memuat produk...</div>
      </section>
    )
  }

  if (!product || loadError) {
    return (
      <section className="pb-20">
        <SeoMeta title="Produk Tidak Ditemukan" description="Produk yang kamu cari tidak tersedia." />
        <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[14px] text-[#c4d3f2]">
          <ArrowLeft className="h-4 w-4" />
          <span>Produk</span>
        </button>
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-4 text-[#c4d3f2]">
          {loadError || 'Produk tidak ditemukan.'}
        </div>
      </section>
    )
  }

  return (
    <section className="pb-20">
      <SeoMeta title={product.name} description={product.description} />
      <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#c4d3f2]">
        <ArrowLeft className="h-4 w-4" />
        <span className="max-w-[240px] truncate">{product.name}</span>
      </button>

      {showLoginRequired && !userId ? <LoginRequiredCard /> : null}

      {!showLoginRequired || userId ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="grid h-[220px] place-items-center rounded-[10px] bg-[#162a57]">
          <img src={product.image || product.image_url} alt={product.name} className="max-h-[180px] w-auto object-contain" />
        </div>

        <h1 className="mt-3 text-[17px] font-medium text-[#e3ebfb]">{product.name}</h1>
        <p className="text-[13px] text-[#8ea6d7]">{product.category || product.category_name}</p>

        <div className="mt-2 flex items-center gap-2 text-[12px] text-[#c4d3f2]">
          <Star className="h-4 w-4 text-[#9fd0ff]" strokeWidth={2} />
          <span>{product.rating} / 5</span>
          <span>&bull;</span>
          <span>Stok {product.stock}</span>
        </div>

        <div className="mt-3 rounded-md border border-[#6e8dc8]/20 bg-[#162a57] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-[#74b8ff]">{product.pi || formatPi(product.price_pi)}</p>
            <p className="text-[14px] font-medium text-[#9fd0ff]">{product.idr || formatIDR(product.price_idr)}</p>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-[#c4d3f2]">{product.description}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-[#6e8dc8]/30 px-2 py-1 text-[#e3ebfb]">
            <button type="button" className="rounded-full p-1 hover:bg-[#162a57]" onClick={() => setQty((prev) => Math.max(1, prev - 1))}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-5 text-center text-[13px]">{qty}</span>
            <button
              type="button"
              className="rounded-full p-1 hover:bg-[#162a57]"
              onClick={() => setQty((prev) => Math.min(Number(product.stock || 1), prev + 1))}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={addToCart}
            disabled={submitting}
            className="cursor-pointer rounded-full bg-[#274786] px-4 py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-70"
          >
            {submitting ? 'Adding...' : 'Add To Cart'}
          </button>
        </div>
        {feedback ? (
          <div className="mt-3 rounded-lg border border-[#6e8dc8]/20 bg-[#162a57] p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#9fd0ff]" />
              <div className="flex-1">
                <p className="text-[12px] text-[#c4d3f2]">{feedback}</p>
                <Link to="/cart" className="mt-2 inline-flex rounded-full bg-[#274786] px-3 py-1 text-[11px] font-medium text-[#e3ebfb]">
                  Lihat Keranjang
                </Link>
              </div>
            </div>
          </div>
        ) : null}
        {actionError === LOGIN_CART_MESSAGE ? (
          <LoginRequiredCard className="mt-3" />
        ) : null}
        {actionError && actionError !== LOGIN_CART_MESSAGE ? (
          <div className="mt-3 rounded-md border border-red-300/20 bg-red-400/10 p-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 text-red-300" />
              <p className="text-[12px] text-red-200">{actionError}</p>
            </div>
          </div>
        ) : null}
        </div>
      ) : null}
    </section>
  )
}
