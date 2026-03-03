import { AlertTriangle, Smartphone } from 'lucide-react'

export default function PiBrowserRequiredPage() {
  const currentHost =
    typeof window !== 'undefined' && window.location?.host
      ? String(window.location.host).toLowerCase()
      : 'mall.pi-executive.com'

  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] items-center px-4 py-8">
      <div className="relative w-full overflow-hidden rounded-3xl border border-[#7aa0ea]/35 bg-[linear-gradient(165deg,#172d5f_0%,#0f2147_48%,#0a1733_100%)] p-6 text-center shadow-[0_16px_36px_rgba(0,0,0,.38)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#5c8df0]/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#2b4f94]/25 blur-2xl" />

        <img src="/logo_pi.png" alt="Executive PI" className="relative mx-auto mb-4 h-11 w-auto" />

        <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[#8ab0f2]/45 bg-[#1a3772]/80">
          <AlertTriangle className="h-7 w-7 text-[#ffd37b]" />
        </div>

        <p className="relative text-[22px] font-semibold tracking-[0.01em] text-[#f2f6ff]">Gunakan Pi Browser</p>
        <p className="relative mt-3 text-[13px] leading-relaxed text-[#c7d8fb]">
          Demi keamanan transaksi dan autentikasi wallet, aplikasi ini hanya dapat diakses melalui Pi Browser.
        </p>

        <div className="relative mt-5 rounded-2xl border border-[#83a9ed]/30 bg-[#132a57]/75 px-4 py-3 text-left">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#9fc2ff]" />
            <p className="text-[12px] leading-relaxed text-[#d8e5ff]">
              Buka dari aplikasi Pi Browser, lalu akses kembali{' '}
              <span className="font-medium text-white">{currentHost}</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
