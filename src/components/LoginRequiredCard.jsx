import { Link } from 'react-router-dom'
import { Lock, LogIn } from 'lucide-react'
import { useI18n } from '../lib/i18n'

export default function LoginRequiredCard({
  title,
  description,
  ctaLabel,
  to = '/login',
  className = '',
}) {
  const { t } = useI18n()

  return (
    <div className={`rounded-2xl border border-[#6e8dc8]/20 bg-[#121f3f] p-5 shadow-[0_1px_4px_rgba(0,0,0,.24)] ${className}`}>
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#1b3368] text-[#9fd0ff]">
        <Lock size={20} />
      </div>
      <p className="text-center text-[14px] font-medium text-[#e3ebfb]">{title || t('loginRequiredTitle')}</p>
      <p className="mt-1 text-center text-[12px] text-[#8ea6d7]">{description || t('loginRequiredDesc')}</p>
      <Link to={to} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#274786] py-2 text-[13px] font-medium text-[#e3ebfb]">
        <LogIn size={15} />
        {ctaLabel || t('loginNow')}
      </Link>
    </div>
  )
}
