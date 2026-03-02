import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Minus, Plus, Star, XCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import { api } from '../lib/api'
import { formatIDR, formatPi } from '../lib/format'
import SeoMeta from '../components/SeoMeta'
import LoginRequiredCard from '../components/LoginRequiredCard'
import { useI18n } from '../lib/i18n'
import { isAddressComplete } from '../lib/address'

const DESCRIPTION_EN_MAP = {
  'Tas kulit premium untuk kebutuhan harian dengan kompartemen utama luas dan material tahan lama.':
    'Premium leather bag for daily use with a spacious main compartment and durable material.',
  'Lipstick matte dengan warna tahan lama, ringan di bibir, dan cocok untuk aktivitas sehari-hari.':
    'Matte lipstick with long-lasting color, lightweight feel, and suitable for daily activities.',
  'Sepatu olahraga ringan dengan grip kuat dan sirkulasi udara yang nyaman untuk penggunaan aktif.':
    'Lightweight sports shoes with strong grip and breathable comfort for active use.',
  'Sepatu premium dengan desain eksklusif, bantalan empuk, dan detail finishing berkualitas tinggi.':
    'Premium shoes with exclusive design, soft cushioning, and high-quality finishing details.',
}

export default function ProductDetailPage({ products, userId, wishlistItems, onToggleWishlist, onCartChanged, onCartAdded }) {
  const { lang } = useI18n()
  const { productId } = useParams()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)
  const [remoteProduct, setRemoteProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showLoginRequired, setShowLoginRequired] = useState(false)
  const isAddressRequiredError =
    actionError.toLowerCase().includes('alamat pengiriman belum diisi') ||
    actionError.toLowerCase().includes('isi alamat terlebih dahulu')

  const product = useMemo(() => {
    const fromList = products.find((p) => String(p.id) === String(productId))
    return fromList || remoteProduct
  }, [products, productId, remoteProduct])
  const isWishlisted = (wishlistItems || []).some((item) => Number(item.id) === Number(product?.id))
  const productDescription = useMemo(() => {
    const raw = String(product?.description || '')
    if (!raw) return ''
    if (lang !== 'en') return raw
    return product?.description_en || DESCRIPTION_EN_MAP[raw] || raw
  }, [lang, product?.description, product?.description_en])

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
        setLoadError(err.message || (lang === 'en' ? 'Failed to load product.' : 'Gagal memuat produk.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProduct()
    return () => {
      active = false
    }
  }, [lang, productId, products])

  const addToCart = async () => {
    if (!product) return
    if (!userId) {
      setActionError(lang === 'en' ? 'Please login in Profile tab before adding cart.' : 'Login dulu di tab Profile sebelum tambah ke keranjang.')
      setShowLoginRequired(true)
      return
    }
    setSubmitting(true)
    setActionError('')
    try {
      const address = await api.getUserAddress(userId)
      if (!isAddressComplete(address)) {
        const msg = 'Isi alamat terlebih dahulu di Profile > Settings.'
        setActionError('')
        toast.error(msg)
        return
      }

      await api.addCartItem({ userId, productId: Number(product.id), qty })
      onCartAdded?.(qty)
      onCartChanged?.(userId)
    } catch (err) {
      const nextError = err.message || (lang === 'en' ? 'Failed to add cart.' : 'Gagal menambahkan ke keranjang.')
      if (String(nextError).toLowerCase().includes('alamat')) {
        setActionError('')
        toast.error(String(nextError))
      } else {
        setActionError(nextError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const toggleWishlist = () => {
    if (!product) return
    const result = onToggleWishlist?.(product)
    if (!result?.ok) {
      toast.error(lang === 'en' ? 'Please login in Profile tab to use wishlist.' : 'Login dulu di tab Profile untuk pakai wishlist.')
      return
    }
    toast.success(
      result.active
        ? lang === 'en'
          ? 'Added to wishlist.'
          : 'Ditambahkan ke wishlist.'
        : lang === 'en'
          ? 'Removed from wishlist.'
          : 'Dihapus dari wishlist.',
    )
  }

  if (loading && !product) {
    return (
      <section className="pb-20">
        <SeoMeta title={lang === 'en' ? 'Loading Product' : 'Memuat Produk'} description={lang === 'en' ? 'Loading product details.' : 'Memuat detail produk.'} />
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-4 text-[#c4d3f2]">{lang === 'en' ? 'Loading product...' : 'Memuat produk...'}</div>
      </section>
    )
  }

  if (!product || loadError) {
    return (
      <section className="pb-20">
        <SeoMeta title={lang === 'en' ? 'Product Not Found' : 'Produk Tidak Ditemukan'} description={lang === 'en' ? 'Requested product is unavailable.' : 'Produk yang kamu cari tidak tersedia.'} />
        <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[14px] text-[#c4d3f2]">
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === 'en' ? 'Product' : 'Produk'}</span>
        </button>
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-4 text-[#c4d3f2]">
          {loadError || (lang === 'en' ? 'Product not found.' : 'Produk tidak ditemukan.')}
        </div>
      </section>
    )
  }

  return (
    <section className="pb-20">
      <SeoMeta title={product.name} description={productDescription} />
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
          <span>{lang === 'en' ? `Stock ${product.stock}` : `Stok ${product.stock}`}</span>
        </div>

        <div className="mt-3 rounded-md border border-[#6e8dc8]/20 bg-[#162a57] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-[#74b8ff]">{product.pi || formatPi(product.price_pi)}</p>
            <p className="text-[14px] font-medium text-[#9fd0ff]">{product.idr || formatIDR(product.price_idr)}</p>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-[#c4d3f2]">{productDescription}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleWishlist}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-[12px] ${isWishlisted ? 'border-[#6e8dc8]/35 bg-[#274786] text-[#e3ebfb]' : 'border-[#6e8dc8]/25 bg-[#162a57] text-[#c4d3f2]'}`}
            >
              <Heart className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? (isWishlisted ? 'Wishlisted' : 'Wishlist') : isWishlisted ? 'Wishlisted' : 'Wishlist'}</span>
            </button>
            <button
              type="button"
              onClick={addToCart}
              disabled={submitting}
              className="cursor-pointer rounded-full bg-[#274786] px-4 py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-70"
            >
              {submitting ? (lang === 'en' ? 'Adding...' : 'Menambah...') : lang === 'en' ? 'Add To Cart' : 'Tambah Ke Keranjang'}
            </button>
          </div>
        </div>
        {actionError && showLoginRequired && !userId ? (
          <LoginRequiredCard className="mt-3" />
        ) : null}
        {actionError && (!showLoginRequired || userId) ? (
          <div className="mt-3 rounded-md border border-red-300/20 bg-red-400/10 p-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 text-red-300" />
              <div className="flex-1">
                <p className="text-[12px] text-red-200">{actionError}</p>
                {isAddressRequiredError ? (
                  <button
                    type="button"
                    onClick={() => navigate('/profile/settings')}
                    className="mt-2 rounded-full border border-red-200/40 px-3 py-1 text-[11px] font-medium text-red-100"
                  >
                    {lang === 'en' ? 'Fill Address' : 'Isi Alamat'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      ) : null}
    </section>
  )
}
