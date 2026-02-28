import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SeoMeta from '../components/SeoMeta'

export default function PaymentReturnPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const data = useMemo(() => {
    const merchantOrderId = params.get('merchantOrderId') || '-'
    const reference = params.get('reference') || '-'
    const resultCode = params.get('resultCode') || ''
    const isSuccess = resultCode === '00'
    return {
      merchantOrderId,
      reference,
      resultCode,
      statusText: isSuccess ? 'Pembayaran berhasil.' : 'Pembayaran belum berhasil / pending.',
      statusClass: isSuccess ? 'text-emerald-300' : 'text-amber-300',
    }
  }, [params])

  return (
    <section className="pb-20">
      <SeoMeta title="Payment Return" description="Status pembayaran dari gateway." />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Payment Return</h2>
      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">
        <p className={`font-medium ${data.statusClass}`}>{data.statusText}</p>
        <p className="mt-2">Result Code: {data.resultCode || '-'}</p>
        <p>Merchant Order ID: {data.merchantOrderId}</p>
        <p>Reference: {data.reference}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/profile/payments')}
            className="rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb]"
          >
            Kembali ke Topup
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="rounded-full border border-[#6e8dc8]/35 bg-[#162a57] py-2 text-[12px] font-medium text-[#e3ebfb]"
          >
            Ke Profile
          </button>
        </div>
      </div>
    </section>
  )
}
