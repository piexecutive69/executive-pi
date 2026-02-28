import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BatteryCharging, Building2, CreditCard, Landmark, MessageCircleMore, Radio, Shapes, Wifi } from 'lucide-react'
import { api } from '../lib/api'
import SeoMeta from '../components/SeoMeta'

function getPrepaidIcon(label) {
  const l = String(label || '').toLowerCase()
  if (l.includes('pulsa')) return Radio
  if (l.includes('data') || l.includes('internet')) return Wifi
  if (l.includes('sms') || l.includes('telpon')) return MessageCircleMore
  if (l.includes('masa')) return BatteryCharging
  if (l.includes('voucher')) return CreditCard
  return Shapes
}

function getPostpaidIcon(label) {
  const l = String(label || '').toLowerCase()
  if (l.includes('pln') || l.includes('listrik')) return Landmark
  if (l.includes('pdam')) return Landmark
  if (l.includes('bpjs')) return Landmark
  if (l.includes('telkomsel') || l.includes('indosat') || l.includes('xl') || l.includes('axis') || l.includes('smartfren')) return Radio
  return Building2
}

export default function PpobPage({ userId }) {
  const navigate = useNavigate()
  const [facets, setFacets] = useState({ prepaid: [], pascabayar: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('prepaid')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadPageData() {
    setLoading(true)
    setError('')
    try {
      const facetData = await api.listDigiflazzFacets()
      setFacets({ prepaid: facetData.prepaid || [], pascabayar: facetData.pascabayar || [] })
    } catch (err) {
      setError(err.message || 'Gagal memuat data PPOB.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPageData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const manualSync = async () => {
    setError('')
    setMessage('')
    try {
      await api.syncDigiflazzPriceList('all')
      setMessage('Sinkronisasi manual berhasil.')
      await loadPageData()
    } catch (err) {
      setError(err.message || 'Sinkronisasi gagal.')
      await loadPageData()
    }
  }

  return (
    <section className="pb-20">
      <SeoMeta title="Pulsa & PPOB" description="Pilih kategori prabayar atau brand pascabayar untuk lanjut pembelian." />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Pulsa & PPOB</h2>

      {loading ? <p className="mb-3 text-[12px] text-[#8ea6d7]">Memuat katalog PPOB...</p> : null}
      {error ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}
      {message ? <p className="mb-3 rounded-md border border-[#6e8dc8]/30 bg-[#162a57] p-2 text-[12px] text-[#c4d3f2]">{message}</p> : null}

      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-medium text-[#c4d3f2]">Katalog Digiflazz</p>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('prepaid')}
            className={`flex-1 rounded-full py-2 text-[12px] ${activeTab === 'prepaid' ? 'bg-[#274786] text-[#e3ebfb]' : 'bg-[#162a57] text-[#9fb4df]'}`}
          >
            Prabayar by Category
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pascabayar')}
            className={`flex-1 rounded-full py-2 text-[12px] ${activeTab === 'pascabayar' ? 'bg-[#274786] text-[#e3ebfb]' : 'bg-[#162a57] text-[#9fb4df]'}`}
          >
            Pascabayar by Brand
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {activeTab === 'prepaid'
            ? facets.prepaid.map((item) => {
                const Icon = getPrepaidIcon(item.facet)
                return (
                  <button
                    key={`pre-${item.facet}`}
                    type="button"
                    onClick={() => navigate(`/ppob/prepaid/${encodeURIComponent(item.facet)}`)}
                    className="rounded-[12px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-3 text-center"
                  >
                    <Icon className="mx-auto h-5 w-5 text-[#9fb4df]" />
                    <p className="mt-1 text-[11px] font-medium leading-tight text-[#e3ebfb]">{item.facet}</p>
                  </button>
                )
              })
            : facets.pascabayar.map((item) => {
                const Icon = getPostpaidIcon(item.facet)
                return (
                  <button
                    key={`post-${item.facet}`}
                    type="button"
                    onClick={() => navigate(`/ppob/postpaid/${encodeURIComponent(item.facet)}`)}
                    className="rounded-[12px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-3 text-center"
                  >
                    <Icon className="mx-auto h-5 w-5 text-[#9fb4df]" />
                    <p className="mt-1 text-[11px] font-medium leading-tight text-[#e3ebfb]">{item.facet}</p>
                  </button>
                )
              })}
          {activeTab === 'prepaid' && !facets.prepaid.length ? <p className="text-[12px] text-[#8ea6d7]">Belum ada data prabayar.</p> : null}
          {activeTab === 'pascabayar' && !facets.pascabayar.length ? <p className="text-[12px] text-[#8ea6d7]">Belum ada data pascabayar.</p> : null}
        </div>
      </div>

    </section>
  )
}
