import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { formatIDR } from '../lib/format'
import SeoMeta from '../components/SeoMeta'

export default function PpobPostpaidCheckPage({ userId }) {
  const navigate = useNavigate()
  const { brandName } = useParams()
  const decodedBrand = decodeURIComponent(brandName || '')
  const [items, setItems] = useState([])
  const [customerNo, setCustomerNo] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [checkResult, setCheckResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await api.listDigiflazzProducts({ type: 'pascabayar', brand: decodedBrand, limit: 100 })
        if (!active) return
        setItems(data.items || [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat produk pascabayar.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [decodedBrand])

  const checkBill = () => {
    if (!selectedItemId || !customerNo) {
      setError('Pilih produk dan isi nomor pelanggan.')
      return
    }
    const product = items.find((it) => Number(it.id) === Number(selectedItemId))
    if (!product) return
    setError('')
    setCheckResult({
      customerNo,
      productName: product.product_name,
      adminEstimate: Number(product.admin_base_idr || 0),
      userLoggedIn: Boolean(userId),
    })
  }

  return (
    <section className="pb-20">
      <SeoMeta title={`Cek Tagihan ${decodedBrand}`} description={`Cek tagihan pascabayar brand ${decodedBrand}.`} />
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => navigate('/ppob')} className="grid h-7 w-7 cursor-pointer place-items-center text-[#c4d3f2]" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-[17px] font-medium text-[#e3ebfb]">{decodedBrand}</h2>
      </div>

      {!userId ? (
        <div className="mb-3 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">
          Anda bisa cek tagihan tanpa login, login dibutuhkan untuk pembayaran.
        </div>
      ) : null}

      {loading ? <p className="mb-3 text-[12px] text-[#8ea6d7]">Memuat produk...</p> : null}
      {error ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}

      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
        <p className="mb-2 text-[13px] font-medium text-[#c4d3f2]">Form Cek Tagihan</p>
        <div className="space-y-2">
          <select
            value={selectedItemId || ''}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none"
          >
            <option value="">Pilih produk pascabayar</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.product_name} ({item.buyer_sku_code})
              </option>
            ))}
          </select>
          <input
            value={customerNo}
            onChange={(e) => setCustomerNo(e.target.value)}
            placeholder="Nomor pelanggan"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <button type="button" onClick={checkBill} className="w-full rounded-full bg-[#274786] py-2 text-[13px] font-medium text-[#e3ebfb]">
            Cek Tagihan
          </button>
        </div>
      </div>

      {checkResult ? (
        <div className="mt-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <p className="text-[13px] font-medium text-[#c4d3f2]">Hasil Cek Tagihan</p>
          <p className="mt-1 text-[12px] text-[#8ea6d7]">Pelanggan: {checkResult.customerNo}</p>
          <p className="text-[12px] text-[#8ea6d7]">Produk: {checkResult.productName}</p>
          <p className="text-[12px] text-[#9fd0ff]">Estimasi admin: {formatIDR(checkResult.adminEstimate)}</p>
          <p className="mt-2 text-[11px] text-[#8ea6d7]">
            Catatan: Endpoint inquiry real Digiflazz akan disambungkan pada tahap integrasi transaksi pascabayar.
          </p>
        </div>
      ) : null}
    </section>
  )
}
