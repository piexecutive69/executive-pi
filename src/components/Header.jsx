import { Search, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

export default function Header({ onOpenDrawer, searchQuery, onSearchChange, cartCount = 0 }) {
  const { lang, setLang, t } = useI18n()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-10 -mx-4 border-b border-[#6e8dc8]/20 bg-[#0a142d] px-4 py-3">
      <div className="flex items-center gap-3">
        <img src="/logo_pi.png" alt={t('appName')} className="h-[44px] w-auto" />
        <label className="flex h-10 flex-1 items-center gap-2 rounded-full border border-[#6e8dc8]/25 bg-[#101d3f] px-4">
          <Search className="h-4 w-4 text-[#c4d3f2]" strokeWidth={2.25} />
          <input
            type="text"
            placeholder={t('searchAnything')}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-transparent text-[14px] text-[#c4d3f2] placeholder:text-[#86a0d2] outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          className="grid h-8 min-w-8 place-items-center rounded-md border border-[#6e8dc8]/25 px-2 text-[11px] font-medium text-[#c4d3f2]"
          aria-label="Toggle language"
        >
          {lang === 'id' ? 'EN' : 'ID'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="relative grid h-8 min-w-8 place-items-center rounded-md border border-[#6e8dc8]/25 px-2 text-[11px] font-medium text-[#c4d3f2]"
          aria-label={t('navCart')}
        >
          <ShoppingCart className="h-4 w-4" strokeWidth={2.1} />
          {Number(cartCount) > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#ff4d4f] px-1 text-center text-[10px] leading-4 text-white">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          ) : null}
        </button>
        <button type="button" onClick={onOpenDrawer} className="grid h-8 w-8 place-items-center" aria-label={t('openMenu')}>
          <img src="/assets/img/icons/menu.svg" alt="" className="h-6 w-6 opacity-90" />
        </button>
      </div>
    </header>
  )
}
