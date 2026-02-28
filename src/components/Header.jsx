import { Search } from 'lucide-react'

export default function Header({ onOpenDrawer }) {
  return (
    <header className="sticky top-0 z-10 -mx-4 border-b border-[#6e8dc8]/20 bg-[#0a142d] px-4 py-3">
      <div className="flex items-center gap-3">
        <img src="/logo_pi.png" alt="Pi Store" className="h-[44px] w-auto" />
        <label className="flex h-10 flex-1 items-center gap-2 rounded-full border border-[#6e8dc8]/25 bg-[#101d3f] px-4">
          <Search className="h-4 w-4 text-[#c4d3f2]" strokeWidth={2.25} />
          <input
            type="text"
            placeholder="Search anything"
            className="w-full bg-transparent text-[14px] text-[#c4d3f2] placeholder:text-[#86a0d2] outline-none"
          />
        </label>
        <button type="button" onClick={onOpenDrawer} className="grid h-8 w-8 place-items-center" aria-label="Open menu">
          <img src="/assets/img/icons/menu.svg" alt="" className="h-6 w-6 opacity-90" />
        </button>
      </div>
    </header>
  )
}
