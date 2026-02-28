import { Bolt, Droplets, HeartPulse, Smartphone, Tv, Wallet } from 'lucide-react'
import { ppobServices, pulsaPackages } from '../data/ppobData'

const serviceIcons = [Bolt, HeartPulse, Droplets, Smartphone, Tv, Wallet]

export default function PpobPage() {
  return (
    <section className="pb-20">
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Pulsa & PPOB</h2>

      <div className="mb-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <p className="mb-2 text-[13px] font-medium text-[#c4d3f2]">Paket Pulsa / Data</p>
        <div className="space-y-2">
          {pulsaPackages.map((item) => (
            <button
              key={`${item.provider}-${item.product}`}
              type="button"
              className="flex w-full items-center justify-between rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-3 py-2 text-left"
            >
              <div>
                <p className="text-[13px] font-medium text-[#e3ebfb]">
                  {item.provider} - {item.product}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-medium text-[#9fd0ff]">{item.priceIdr}</p>
                <p className="text-[11px] text-[#74b8ff]">{item.pricePi}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-[#c4d3f2]">Layanan PPOB</p>
        <div className="grid grid-cols-2 gap-3">
          {ppobServices.map((item, idx) => {
            const Icon = serviceIcons[idx] || Wallet
            return (
              <button
                key={item.name}
                type="button"
                className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-left shadow-[0_1px_4px_rgba(0,0,0,.24)]"
              >
                <Icon className="mb-2 h-5 w-5 text-[#9fb4df]" strokeWidth={2} />
                <p className="text-[13px] font-medium text-[#e3ebfb]">{item.name}</p>
                <p className="mt-1 text-[11px] text-[#8ea6d7]">{item.fee}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
