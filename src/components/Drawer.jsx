import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileMenus } from '../constants/profileMenus'
import { toApiAssetUrl } from '../lib/api'
import { formatIDR, formatPi } from '../lib/format'
import { useI18n } from '../lib/i18n'

export default function Drawer({ open, onClose, user, onLogout }) {
  const navigate = useNavigate()
  const { lang } = useI18n()
  const userId = user?.id || null

  const profile = useMemo(
    () => ({
      name: user?.name || (lang === 'en' ? 'Guest User' : 'Guest User'),
      email: user?.email || (lang === 'en' ? 'Not logged in' : 'Belum login'),
      profileImageUrl: toApiAssetUrl(user?.profile_image_url) || '/assets/img/profile.jpg',
      idrBalance: Number(user?.idr_balance || 0),
      piBalance: Number(user?.pi_balance || 0),
    }),
    [lang, user],
  )

  function go(to) {
    navigate(to)
    onClose?.()
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-40 h-full w-[286px] border-l border-[#6e8dc8]/30 bg-gradient-to-b from-[#111f43] to-[#0a142d] p-5 shadow-[-8px_0_24px_rgba(0,0,0,.35)] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="rounded-2xl border border-[#6e8dc8]/20 bg-[#162a57]/65 p-4 text-center">
          <img
            src={profile.profileImageUrl}
            alt={profile.name}
            className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-white/70"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = '/assets/img/profile.jpg'
            }}
          />
          <p className="mt-3 text-[18px] font-medium leading-tight text-[#e3ebfb]">{profile.name}</p>
          <p className="mt-1 text-[12px] text-[#9cb2de]">{profile.email}</p>
        </div>

        {userId ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-2 text-center">
              <p className="text-[10px] text-[#8ea6d7]">{lang === 'en' ? 'IDR Balance' : 'Saldo IDR'}</p>
              <p className="mt-1 text-[11px] font-medium text-[#9fd0ff]">{formatIDR(profile.idrBalance)}</p>
            </div>
            <div className="rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-2 text-center">
              <p className="text-[10px] text-[#8ea6d7]">{lang === 'en' ? 'Pi Balance' : 'Saldo Pi'}</p>
              <p className="mt-1 text-[11px] font-medium text-[#74b8ff]">{formatPi(profile.piBalance)}</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => go('/login')}
            className="mt-3 w-full rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb]"
          >
            {lang === 'en' ? 'Login / Register' : 'Login / Daftar'}
          </button>
        )}

        <ul className="mt-5 space-y-1">
          {profileMenus.map((menu) => (
            <li key={menu.key}>
              <button
                type="button"
                onClick={() => go(`/profile/${menu.key}`)}
                disabled={!userId}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                  userId ? 'text-[#c4d3f2] hover:bg-[#1a3269]' : 'cursor-not-allowed text-[#6f86b5] opacity-55'
                }`}
              >
                <menu.icon className="h-4 w-4 text-[#9fb4df]" strokeWidth={2} />
                {lang === 'en' ? menu.enLabel : menu.idLabel}
              </button>
            </li>
          ))}
        </ul>

        {userId ? (
          <button
            type="button"
            onClick={() => {
              onLogout?.()
              onClose?.()
            }}
            className="mt-4 w-full rounded-full border border-[#6e8dc8]/30 bg-[#162a57] py-2 text-[13px] font-medium text-[#e3ebfb]"
          >
            {lang === 'en' ? 'Logout' : 'Keluar'}
          </button>
        ) : null}
      </aside>
    </>
  )
}
