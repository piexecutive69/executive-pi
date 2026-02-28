import { NavLink } from 'react-router-dom'
import { House, ReceiptText, ShoppingCart, User } from 'lucide-react'
import { useI18n } from '../lib/i18n'

export default function BottomNav() {
  const { t } = useI18n()
  const menus = [
    { to: '/', label: t('navHome'), icon: House },
    { to: '/ppob', label: t('navPpob'), icon: ReceiptText },
    { to: '/cart', label: t('navCart'), icon: ShoppingCart },
    { to: '/profile', label: t('navProfile'), icon: User },
  ]

  return (
    <nav className="fixed bottom-2 left-1/2 z-20 flex w-[calc(100%-12px)] -translate-x-1/2 justify-between rounded-[34px] border border-[#6e8dc8]/20 bg-[#0b1632]/95 px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,.32)] md:max-w-[376px]">
      {menus.map((menu) => (
        <NavLink
          key={menu.label}
          to={menu.to}
          end={menu.to === '/'}
          className="flex h-[70px] w-[78px] flex-col items-center justify-center gap-1 transition-colors"
        >
          {({ isActive }) => (
            <>
              <menu.icon className={`h-5 w-5 ${isActive ? 'text-[#c4d3f2]' : 'text-[#6e8dc8]'}`} strokeWidth={2} />
              <span className={`text-[12px] font-medium ${isActive ? 'text-[#c4d3f2]' : 'text-[#6e8dc8]'}`}>{menu.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
