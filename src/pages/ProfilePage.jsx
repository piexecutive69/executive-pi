import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CircleHelp, FileText, Settings, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react'
import { api, toApiAssetUrl } from '../lib/api'
import { formatIDR, formatPi } from '../lib/format'
import SeoMeta from '../components/SeoMeta'
import { useI18n } from '../lib/i18n'

const profileMenus = [
  { key: 'orders', idLabel: 'Pesanan Saya', enLabel: 'My Orders', icon: ShoppingBag },
  { key: 'wishlist', idLabel: 'Wishlist', enLabel: 'Wishlist', icon: UserRound },
  { key: 'notifications', idLabel: 'Notifikasi', enLabel: 'Notifications', icon: Bell },
  { key: 'settings', idLabel: 'Pengaturan', enLabel: 'Settings', icon: Settings },
  { key: 'privacy', idLabel: 'Kebijakan Privasi', enLabel: 'Privacy Policy', icon: ShieldCheck },
  { key: 'terms', idLabel: 'Syarat & Ketentuan', enLabel: 'Terms & Conditions', icon: FileText },
  { key: 'help', idLabel: 'Pusat Bantuan', enLabel: 'Help Center', icon: CircleHelp },
]

export default function ProfilePage({ user, onLogout }) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const userId = user?.id || null
  const [wallet, setWallet] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadProfileSupportData() {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      const walletRes = await api.getWalletBalance(userId)
      setWallet(walletRes)
    } catch (err) {
      setError(err.message || (lang === 'en' ? 'Failed to load profile data.' : 'Gagal memuat data profile.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfileSupportData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const displayUser = useMemo(
    () => ({
      name: user?.name || 'Guest User',
      email: user?.email || (lang === 'en' ? 'Not logged in' : 'Belum login'),
      profileImageUrl: toApiAssetUrl(user?.profile_image_url) || '/assets/img/profile.jpg',
    }),
    [user, lang],
  )

  return (
    <section className="pb-20">
      <SeoMeta
        title={lang === 'en' ? 'Profile' : 'Profil'}
        description={lang === 'en' ? 'Manage account, orders, notifications, payment methods, and profile settings.' : 'Kelola akun, order, notifikasi, metode pembayaran, dan pengaturan profil.'}
      />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Profile' : 'Profil'}</h2>
      {loading ? <p className="mb-3 text-[12px] text-[#8ea6d7]">{lang === 'en' ? 'Loading profile...' : 'Memuat profile...'}</p> : null}
      {error ? <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}

      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="flex items-center gap-3">
          <img
            src={displayUser.profileImageUrl}
            alt={displayUser.name}
            className="h-16 w-16 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = '/assets/img/profile.jpg'
            }}
          />
          <div>
            <p className="text-[16px] font-medium leading-tight text-[#e3ebfb]">{displayUser.name}</p>
            <p className="text-[12px] text-[#8ea6d7]">{displayUser.email}</p>
          </div>
        </div>
        {!userId ? (
          <Link to="/login" className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#274786] py-2 text-[13px] font-medium text-[#e3ebfb]">
            {lang === 'en' ? 'Login' : 'Masuk'}
          </Link>
        ) : null}
      </div>

      {userId ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-2 text-center">
            <p className="text-[11px] text-[#8ea6d7]">{lang === 'en' ? 'IDR Balance' : 'Saldo IDR'}</p>
            <p className="mt-1 text-[12px] font-medium text-[#9fd0ff]">{formatIDR(wallet?.idr_balance)}</p>
          </div>
          <div className="rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-2 text-center">
            <p className="text-[11px] text-[#8ea6d7]">{lang === 'en' ? 'Pi Balance' : 'Saldo Pi'}</p>
            <p className="mt-1 text-[12px] font-medium text-[#74b8ff]">{formatPi(wallet?.pi_balance)}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile/payments')}
            className="cursor-pointer rounded-[10px] border border-[#6e8dc8]/25 bg-[#1b3368] px-2 py-2 text-center"
          >
            <p className="text-[11px] text-[#9fb4df]">{lang === 'en' ? 'Top Up' : 'Topup'}</p>
            <p className="mt-1 text-[12px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Add Balance' : 'Isi Saldo'}</p>
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {profileMenus.map((menu) => (
          <button
            key={menu.key}
            type="button"
            disabled={!userId}
            onClick={() => navigate(`/profile/${menu.key}`)}
            className={`flex w-full items-center gap-2 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] px-3 py-2 text-left ${!userId ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
          >
            <menu.icon className="h-4 w-4 text-[#9fb4df]" strokeWidth={2} />
            <span className="text-[12px] text-[#c4d3f2]">{lang === 'en' ? menu.enLabel : menu.idLabel}</span>
          </button>
        ))}
      </div>

      {userId ? (
        <div className="mt-3 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <button
            type="button"
            onClick={onLogout}
            className="w-full cursor-pointer rounded-full border border-[#6e8dc8]/30 bg-[#162a57] py-2 text-[13px] font-medium text-[#e3ebfb]"
          >
            {lang === 'en' ? 'Logout' : 'Keluar'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
