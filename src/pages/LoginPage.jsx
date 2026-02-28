import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import SeoMeta from '../components/SeoMeta'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

export default function LoginPage({ onLogin }) {
  const { lang, t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [phone, setPhone] = useState(location.state?.registeredPhone || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!phone.trim() || !password.trim()) {
      toast.error(t('phonePasswordRequired'))
      return
    }
    setLoading(true)
    try {
      const user = await api.loginByPhone({ phone: phone.trim(), password })
      onLogin?.(user)
      toast.success(t('loginSuccess'))
      navigate('/profile', { replace: true })
    } catch (err) {
      toast.error(err.message || t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pb-20">
      <SeoMeta title={t('login')} description={lang === 'en' ? 'Sign in using phone number and password.' : 'Masuk akun dengan nomor HP dan password.'} />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">{t('login')}</h2>
      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="space-y-2">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Nomor HP"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="cursor-pointer w-full rounded-full bg-[#274786] px-4 py-2 text-[12px] font-medium text-[#e3ebfb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (lang === 'en' ? 'Signing in...' : 'Masuk...') : t('login')}
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] text-[#8ea6d7]">
          {lang === 'en' ? "Don't have an account?" : 'Belum punya akun?'}{' '}
          <Link to="/register" className="cursor-pointer text-[#9fd0ff]">
            {t('register')}
          </Link>
        </p>
      </div>
    </section>
  )
}
