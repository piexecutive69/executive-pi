import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import SeoMeta from '../components/SeoMeta'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

export default function RegisterPage() {
  const { lang, t } = useI18n()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      toast.error(t('requiredFields'))
      return
    }
    if (form.password.trim().length < 6) {
      toast.error(t('minPassword'))
      return
    }
    setLoading(true)
    try {
      await api.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      toast.success(t('registerSuccess'))
      navigate('/login', { replace: true, state: { registeredPhone: form.phone.trim() } })
    } catch (err) {
      toast.error(err.message || t('registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pb-20">
      <SeoMeta title={t('register')} description={lang === 'en' ? 'Create a new account to start shopping.' : 'Buat akun baru untuk mulai belanja.'} />
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">{t('register')}</h2>
      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="space-y-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Nama"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="Email"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="Nomor HP"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange('password', e.target.value)}
            placeholder="Password"
            className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="cursor-pointer w-full rounded-full bg-[#274786] px-4 py-2 text-[12px] font-medium text-[#e3ebfb] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (lang === 'en' ? 'Registering...' : 'Mendaftar...') : t('register')}
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] text-[#8ea6d7]">
          {lang === 'en' ? 'Already have an account?' : 'Sudah punya akun?'}{' '}
          <Link to="/login" className="cursor-pointer text-[#9fd0ff]">
            {t('login')}
          </Link>
        </p>
      </div>
    </section>
  )
}
