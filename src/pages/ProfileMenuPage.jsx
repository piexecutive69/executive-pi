import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import LoginRequiredCard from '../components/LoginRequiredCard'
import ProfileSettingsForm from '../components/ProfileSettingsForm'
import SeoMeta from '../components/SeoMeta'
import { api } from '../lib/api'
import { formatIDR } from '../lib/format'
import { useI18n } from '../lib/i18n'

const menuMeta = {
  orders: { idTitle: 'Pesanan Saya', enTitle: 'My Orders' },
  wishlist: { idTitle: 'Wishlist', enTitle: 'Wishlist' },
  notifications: { idTitle: 'Notifikasi', enTitle: 'Notifications' },
  settings: { idTitle: 'Pengaturan', enTitle: 'Settings' },
  payments: { idTitle: 'Metode Pembayaran', enTitle: 'Payment Methods' },
  privacy: { idTitle: 'Kebijakan Privasi', enTitle: 'Privacy Policy' },
  terms: { idTitle: 'Syarat & Ketentuan', enTitle: 'Terms & Conditions' },
  help: { idTitle: 'Pusat Bantuan', enTitle: 'Help Center' },
}

export default function ProfileMenuPage({ user, onUserUpdated, wishlistItems = [], onToggleWishlist }) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const { menuKey = '' } = useParams()
  const userId = user?.id || null
  const [orders, setOrders] = useState([])
  const [topupAmount, setTopupAmount] = useState(10000)
  const [topupLoading, setTopupLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [topupQris, setTopupQris] = useState({ open: false, url: '', reference: '', qrString: '' })

  const currentMenu = useMemo(() => menuMeta[menuKey] || null, [menuKey])
  const currentMenuTitle = currentMenu ? (lang === 'en' ? currentMenu.enTitle : currentMenu.idTitle) : ''

  useEffect(() => {
    if (!userId || menuKey !== 'orders') return
    let active = true

    async function loadOrders() {
      setLoading(true)
      try {
        const data = await api.listOrders(userId)
        if (!active) return
        setOrders(data || [])
      } catch (err) {
        if (!active) return
        toast.error(err.message || (lang === 'en' ? 'Failed to load orders.' : 'Gagal memuat orders.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadOrders()
    return () => {
      active = false
    }
  }, [menuKey, userId, lang])

  const topup = async () => {
    if (Number(topupAmount) <= 0) {
      toast.error(lang === 'en' ? 'Top up amount must be greater than 0.' : 'Nominal topup harus lebih dari 0.')
      return
    }
    setTopupLoading(true)
    try {
      const res = await api.topupWalletDuitku({ userId, amountIdr: Number(topupAmount) })
      toast.success(lang === 'en' ? 'Top up invoice created successfully.' : 'Invoice topup berhasil dibuat.')
      setTopupQris({
        open: true,
        url: res.paymentUrl || '',
        reference: res.paymentReference || res.externalReference || '',
        qrString: res.qrString || '',
      })
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to create top up.' : 'Gagal membuat topup.'))
    } finally {
      setTopupLoading(false)
    }
  }

  if (!currentMenu) {
    return (
      <section className="pb-20">
        <SeoMeta title={lang === 'en' ? 'Profile Menu' : 'Menu Profil'} description={lang === 'en' ? 'Profile menu was not found.' : 'Menu profile tidak ditemukan.'} />
        <button type="button" onClick={() => navigate('/profile')} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#c4d3f2]">
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === 'en' ? 'Profile' : 'Profil'}</span>
        </button>
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">{lang === 'en' ? 'Menu not found.' : 'Menu tidak ditemukan.'}</div>
      </section>
    )
  }

  return (
    <section className="pb-20">
      <SeoMeta
        title={currentMenuTitle}
        description={lang === 'en' ? `${currentMenuTitle} page for user account.` : `Halaman ${currentMenuTitle} pengguna.`}
      />
      <button type="button" onClick={() => navigate('/profile')} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#c4d3f2]">
        <ArrowLeft className="h-4 w-4" />
        <span>{currentMenuTitle}</span>
      </button>

      {!userId ? <LoginRequiredCard /> : null}

      {userId && menuKey === 'orders' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
          {loading ? <p className="text-[12px] text-[#8ea6d7]">{lang === 'en' ? 'Loading orders...' : 'Memuat order...'}</p> : null}
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-3 py-2">
                <p className="text-[12px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Order' : 'Pesanan'} #{order.id}</p>
                <p className="text-[11px] text-[#8ea6d7]">{order.status}</p>
                <p className="text-[11px] text-[#9fd0ff]">{formatIDR(order.total_idr)}</p>
              </div>
            ))}
            {!loading && !orders.length ? <p className="text-[12px] text-[#8ea6d7]">{lang === 'en' ? 'No orders yet.' : 'Belum ada order.'}</p> : null}
          </div>
        </div>
      ) : null}

      {userId && menuKey === 'payments' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
          <p className="mb-2 text-[13px] font-medium text-[#c4d3f2]">{lang === 'en' ? 'IDR Balance Top Up (Duitku)' : 'Topup Saldo IDR (Duitku)'}</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1000}
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              disabled={topupLoading}
              className="h-10 flex-1 rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none"
            />
            <button
              type="button"
              onClick={topup}
              disabled={topupLoading}
              className="cursor-pointer rounded-full bg-[#274786] px-4 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-60"
            >
              {topupLoading ? (lang === 'en' ? 'Loading QRIS...' : 'Memuat QRIS...') : lang === 'en' ? 'Top Up' : 'Topup'}
            </button>
          </div>
          {topupLoading ? (
            <div className="mt-3 rounded-md border border-[#6e8dc8]/25 bg-[#162a57] p-3">
              <p className="text-[12px] text-[#c4d3f2]">{lang === 'en' ? 'Generating QRIS, please wait...' : 'Membuat QRIS, mohon tunggu...'}</p>
              <div className="mt-2 h-[300px] animate-pulse rounded-md bg-[#0f2046]" />
            </div>
          ) : null}
          {topupQris.reference ? (
            <p className="mt-2 text-[11px] text-[#8ea6d7]">
              Ref: {topupQris.reference}
            </p>
          ) : null}
          {topupQris.open ? (
            <div className="mt-3 rounded-md border border-[#6e8dc8]/25 bg-[#162a57] p-2">
              <p className="mb-2 text-[12px] text-[#c4d3f2]">
                {lang === 'en' ? 'Scan this QRIS directly from app.' : 'Scan QRIS ini langsung dari aplikasi.'}
              </p>
              {topupQris.qrString ? (
                <img
                  src={`https://quickchart.io/qr?size=300&text=${encodeURIComponent(topupQris.qrString)}`}
                  alt="QRIS"
                  className="mx-auto h-[300px] w-[300px] rounded-md border border-[#6e8dc8]/20 bg-white p-2"
                />
              ) : (
                <p className="rounded-md border border-amber-300/20 bg-amber-400/10 p-2 text-[11px] text-amber-200">
                  {lang === 'en'
                    ? 'QR string is unavailable. Please use the payment page link.'
                    : 'QR string tidak tersedia. Silakan gunakan link halaman pembayaran.'}
                </p>
              )}
              {topupQris.qrString ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(topupQris.qrString)
                    toast.success(lang === 'en' ? 'QR string copied.' : 'QR string berhasil disalin.')
                  }}
                  className="mt-2 w-full rounded-full border border-[#6e8dc8]/35 bg-[#0f2046] py-2 text-[12px] text-[#e3ebfb]"
                >
                  {lang === 'en' ? 'Copy QR String' : 'Salin QR String'}
                </button>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTopupQris((prev) => ({ ...prev, open: false }))}
                  className="rounded-full border border-[#6e8dc8]/35 bg-[#0f2046] py-2 text-[12px] text-[#e3ebfb]"
                >
                  {lang === 'en' ? 'Close QRIS' : 'Tutup QRIS'}
                </button>
                <a
                  href={topupQris.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#274786] py-2 text-center text-[12px] font-medium text-[#e3ebfb]"
                >
                  {lang === 'en' ? 'Open New Tab' : 'Buka Tab Baru'}
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {userId && menuKey === 'wishlist' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          {wishlistItems.length ? (
            <div className="space-y-2">
              {wishlistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-[10px] border border-[#6e8dc8]/25 bg-[#162a57] px-2 py-2">
                  <img
                    src={item.image_url || '/assets/img/profile.jpg'}
                    alt={item.name}
                    className="h-12 w-12 rounded-md object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = '/assets/img/profile.jpg'
                    }}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`/product/${item.id}`)}
                  >
                    <p className="truncate text-[12px] font-medium text-[#e3ebfb]">{item.name}</p>
                    <p className="text-[11px] text-[#8ea6d7]">{item.category_name}</p>
                    <p className="text-[11px] text-[#9fd0ff]">{formatIDR(item.price_idr)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist?.(item)}
                    className="cursor-pointer rounded-full border border-[#6e8dc8]/30 bg-[#1b3368] px-3 py-1 text-[11px] text-[#e3ebfb]"
                  >
                    {lang === 'en' ? 'Remove' : 'Hapus'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#c4d3f2]">{lang === 'en' ? 'Wishlist is empty.' : 'Wishlist masih kosong.'}</p>
          )}
        </div>
      ) : null}

      {userId && menuKey === 'notifications' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">{lang === 'en' ? 'No new notifications.' : 'Tidak ada notifikasi baru.'}</div>
      ) : null}

      {userId && menuKey === 'privacy' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">
          <h3 className="text-[13px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Privacy Policy' : 'Kebijakan Privasi'}</h3>
          {lang === 'en' ? (
            <div className="mt-3 space-y-2">
              <p>This policy governs the processing of personal and transaction data in Mall Executive PI, including marketplace, PPOB, wallet, affiliate, and membership upgrade systems.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">1. Scope:</span> applies to all users, visitors, members, resellers, agents, and distributors using web/app/API channels.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">2. Data Categories:</span> identity (name, phone, email), account credentials, KYC/support records, device fingerprint, IP, geolocation approximation, and browser/session metadata.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">3. Transaction Data:</span> order history, cart activity, PPOB purchase details, postpaid inquiry logs, top-up invoices, wallet ledger, and payout/bonus records.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">4. Membership Data:</span> level status (member/reseller/agent/distributor), upgrade history, qualification checks, and level-based pricing/markup mapping.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">5. Affiliate Network Data:</span> referral/upline-downline mapping up to 3 levels, transaction bonus calculation logs, bonus settlement status, and anti-manipulation flags.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">6. Purpose of Processing:</span> account verification, fraud prevention, service delivery, dynamic pricing by membership level, bonus distribution, support, and legal compliance.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">7. Legal Basis:</span> user consent, contractual necessity, legitimate interests in platform security, and mandatory legal/regulatory obligations.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">8. Third-Party Integrations:</span> limited data sharing with payment gateway providers, digital-product providers, and compliance authorities when required.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">9. Payment & Wallet Privacy:</span> payment references are stored for reconciliation; sensitive instrument data is handled by licensed payment partners under their PCI/security controls.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">10. PPOB Privacy:</span> destination account/number and transaction identifiers are processed strictly to complete prepaid/postpaid services and dispute handling.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">11. Upgrade System Privacy:</span> upgrade eligibility and audit logs are retained to ensure fair enforcement of level rules and bonus entitlement integrity.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">12. Automated Decisioning:</span> the platform may use risk scoring to detect abnormal behavior (duplicate accounts, abuse patterns, suspicious velocity).</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">13. Security Controls:</span> role-based access, environment separation, API key protection, query logging, and anomaly alerts are implemented to reduce unauthorized access risks.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">14. Data Retention:</span> records are retained according to operational, accounting, anti-fraud, and legal dispute timelines; expired data is archived or removed securely.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">15. User Rights:</span> users may request data access, correction, update, processing limitation, and account closure, subject to regulatory and audit exceptions.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">16. Cookies & Tracking:</span> used for session continuity, login persistence, language preference, and abuse mitigation.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">17. Cross-Border Processing:</span> if infrastructure requires cross-region processing, equivalent safeguards are applied for confidentiality and integrity.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">18. Breach Response:</span> incidents are handled through internal response procedures, impact assessment, containment, and required notifications.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">19. Policy Changes:</span> material updates (pricing logic, upgrade mechanism, bonus policy, or partner changes) will be announced in-app or official channels.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">20. Contact:</span> support@pi-executive.com for privacy requests and data-related complaints.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p>Kebijakan ini mengatur pemrosesan data pribadi dan data transaksi pada Mall Executive PI, termasuk marketplace, PPOB, wallet, afiliasi, dan sistem upgrade membership.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">1. Ruang lingkup:</span> berlaku bagi seluruh pengguna, member, reseller, agen, distributor di kanal web/aplikasi/API.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">2. Kategori data:</span> identitas (nama, nomor HP, email), kredensial akun, catatan support/KYC, fingerprint perangkat, IP, perkiraan lokasi, metadata sesi/browser.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">3. Data transaksi:</span> riwayat order, aktivitas keranjang, detail pembelian PPOB, log cek tagihan pascabayar, invoice topup, ledger wallet, dan bonus afiliasi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">4. Data membership:</span> status level (member/reseller/agen/distributor), riwayat upgrade, evaluasi syarat, dan pemetaan harga/markup per level.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">5. Data jaringan afiliasi:</span> peta referral/upline-downline hingga 3 level, log perhitungan bonus transaksi, status settlement bonus, dan flag anti-manipulasi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">6. Tujuan penggunaan:</span> verifikasi akun, pencegahan fraud, penyediaan layanan, harga dinamis per level, distribusi bonus, support, dan kepatuhan hukum.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">7. Dasar hukum pemrosesan:</span> persetujuan pengguna, kebutuhan kontraktual, kepentingan sah keamanan platform, dan kewajiban hukum/regulator.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">8. Integrasi pihak ketiga:</span> data tertentu dibagikan terbatas ke mitra payment gateway, penyedia produk digital, dan otoritas bila diwajibkan.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">9. Privasi pembayaran & wallet:</span> referensi pembayaran disimpan untuk rekonsiliasi; data instrumen sensitif dikelola oleh mitra pembayaran berlisensi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">10. Privasi PPOB:</span> nomor tujuan/identitas pelanggan diproses hanya untuk mengeksekusi transaksi prabayar/pascabayar dan penanganan komplain.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">11. Privasi sistem upgrade:</span> log kelayakan upgrade disimpan untuk menjaga keadilan aturan level dan validitas hak bonus.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">12. Keputusan otomatis:</span> sistem dapat menerapkan scoring risiko untuk deteksi duplikasi akun, penyalahgunaan bonus, dan anomali transaksi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">13. Kontrol keamanan:</span> role-based access, pemisahan environment, perlindungan API key, query logging, dan alert anomali diterapkan.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">14. Retensi data:</span> data disimpan sesuai kebutuhan operasional, akuntansi, anti-fraud, audit, dan sengketa hukum; data kadaluarsa diarsipkan/dihapus aman.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">15. Hak pengguna:</span> pengguna dapat meminta akses, koreksi, pembaruan, pembatasan pemrosesan, dan penutupan akun sesuai ketentuan berlaku.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">16. Cookie & tracking:</span> digunakan untuk sesi login, preferensi bahasa, kontinuitas penggunaan, dan mitigasi abuse.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">17. Pemrosesan lintas wilayah:</span> bila infrastruktur memerlukan, perlindungan setara atas kerahasiaan dan integritas tetap diterapkan.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">18. Respons insiden:</span> kebocoran/insiden ditangani dengan prosedur internal, containment, evaluasi dampak, dan notifikasi yang diwajibkan.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">19. Perubahan kebijakan:</span> perubahan material (pricing logic, upgrade, bonus, mitra) akan diumumkan melalui aplikasi/kanal resmi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">20. Kontak:</span> support@pi-executive.com untuk permintaan terkait privasi atau pengaduan data.</p>
            </div>
          )}
        </div>
      ) : null}

      {userId && menuKey === 'terms' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">
          <h3 className="text-[13px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Terms & Conditions' : 'Syarat & Ketentuan'}</h3>
          {lang === 'en' ? (
            <div className="mt-3 space-y-2">
              <p>These terms govern all transactions and platform activities in Mall Executive PI, including marketplace, PPOB, wallet funding, affiliate bonus, and membership upgrades.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">1. Eligibility & Account:</span> users must provide valid information, maintain credential security, and are responsible for all account activities.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">2. Membership Levels:</span> levels consist of Member, Reseller, Agent, and Distributor with distinct pricing and benefits.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">3. Upgrade Rules:</span> level upgrades follow system requirements, verification checks, and may involve administrative fees/non-refundable costs.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">4. Pricing & Markup:</span> displayed prices may include level-based markup; higher levels may receive lower final prices as configured by platform policy.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">5. Affiliate Bonus (3 Levels):</span> bonus distributions follow upline structure up to level-3, based on valid completed transactions and anti-fraud validation.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">6. Bonus Limitation:</span> self-referral, fake transactions, account farming, or circular structures may void bonus and trigger account sanctions.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">7. PPOB & Digital Transactions:</span> prepaid/postpaid execution follows provider availability; successful provider response is considered completed service.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">8. Input Responsibility:</span> users are responsible for destination number/account correctness; wrong input by user is not automatically refundable.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">9. Payment Methods:</span> transactions may use IDR wallet, Pi (when enabled), and payment gateway channels according to availability.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">10. Wallet Top Up:</span> wallet balance is credited only after valid settlement/callback confirmation from payment partners.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">11. Failed/Pending Transactions:</span> pending status may occur due to partner latency; reconciliation uses internal logs and provider references.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">12. Refund Policy:</span> refunds are processed for validated failures/duplicates; timing depends on investigation and partner settlement cycles.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">13. Fees & Charges:</span> administrative fees, service fees, and partner charges may apply and are shown at checkout/confirmation steps.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">14. Service Availability:</span> features may be temporarily unavailable for maintenance, partner downtime, fraud review, or legal requirements.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">15. Suspension & Termination:</span> platform may suspend/terminate accounts involved in abuse, legal violations, AML/KYC concerns, or security risks.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">16. Intellectual Property:</span> platform branding, software logic, and content remain protected and may not be copied/distributed without permission.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">17. Limitation of Liability:</span> platform is not liable for losses from user negligence, external outages, or third-party failures beyond reasonable control.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">18. Compliance:</span> users agree not to use the platform for illegal, fraudulent, money-laundering, or sanctioned activities.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">19. Terms Updates:</span> terms may be updated to reflect system upgrades, bonus policy changes, pricing rules, and regulatory requirements.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">20. Governing Law & Disputes:</span> disputes are resolved amicably first, then through Indonesian legal jurisdiction if unresolved.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p>Syarat ini mengatur seluruh aktivitas di Mall Executive PI, termasuk marketplace, PPOB, pendanaan wallet, bonus afiliasi, dan upgrade membership.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">1. Kelayakan & akun:</span> pengguna wajib memberikan data valid, menjaga kredensial, dan bertanggung jawab atas seluruh aktivitas akun.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">2. Level membership:</span> level terdiri dari Member, Reseller, Agen, dan Distributor dengan benefit serta skema harga berbeda.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">3. Aturan upgrade:</span> upgrade level mengikuti syarat sistem, verifikasi internal, dan dapat melibatkan biaya administratif/non-refundable tertentu.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">4. Harga & markup:</span> harga tampil dapat mencakup markup berbasis level; level lebih tinggi dapat memperoleh harga final lebih rendah.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">5. Bonus afiliasi 3 level:</span> bonus dibagikan berdasarkan struktur upline hingga level-3 dari transaksi valid yang selesai dan lolos validasi anti-fraud.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">6. Pembatasan bonus:</span> self-referral, transaksi fiktif, farming akun, atau struktur sirkular dapat membatalkan bonus dan memicu sanksi akun.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">7. PPOB & produk digital:</span> eksekusi transaksi mengikuti ketersediaan provider; respons sukses provider dianggap layanan selesai.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">8. Tanggung jawab input:</span> pengguna wajib memastikan nomor/ID tujuan benar; kesalahan input pengguna tidak otomatis bisa direfund.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">9. Metode pembayaran:</span> transaksi dapat memakai wallet IDR, Pi (jika aktif), atau payment gateway sesuai ketersediaan.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">10. Topup wallet:</span> saldo wallet masuk hanya setelah settlement/callback valid dari mitra pembayaran.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">11. Transaksi pending/gagal:</span> status pending dapat terjadi karena latensi mitra; rekonsiliasi menggunakan log internal dan referensi provider.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">12. Kebijakan refund:</span> refund diproses untuk gagal/duplikat terverifikasi; lama proses mengikuti investigasi dan settlement mitra.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">13. Biaya layanan:</span> biaya admin, biaya layanan, dan charge mitra dapat berlaku serta ditampilkan di tahap checkout/konfirmasi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">14. Ketersediaan layanan:</span> fitur dapat tidak tersedia sementara karena maintenance, downtime mitra, audit fraud, atau kewajiban hukum.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">15. Suspend/terminasi:</span> platform berhak membatasi/menutup akun yang terlibat abuse, pelanggaran hukum, risiko keamanan, atau isu AML/KYC.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">16. Hak kekayaan intelektual:</span> brand, software, logika sistem, dan konten platform dilindungi dan tidak boleh disalin tanpa izin.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">17. Batas tanggung jawab:</span> platform tidak bertanggung jawab atas kerugian akibat kelalaian pengguna atau kegagalan pihak ketiga di luar kendali wajar.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">18. Kepatuhan:</span> pengguna dilarang memakai layanan untuk aktivitas ilegal, fraud, pencucian uang, atau aktivitas terlarang lainnya.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">19. Perubahan ketentuan:</span> syarat dapat diperbarui mengikuti upgrade sistem, perubahan bonus, aturan harga, dan regulasi.</p>
              <p><span className="mb-1 block font-medium text-[#e3ebfb]">20. Hukum & sengketa:</span> sengketa diselesaikan musyawarah terlebih dahulu, lalu mengikuti yurisdiksi hukum Indonesia.</p>
            </div>
          )}
        </div>
      ) : null}

      {userId && menuKey === 'help' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 text-[12px] text-[#c4d3f2]">
          {lang === 'en' ? 'Contact support: support@pi-executive.com' : 'Hubungi support: support@pi-executive.com'}
        </div>
      ) : null}

      {userId && menuKey === 'settings' ? (
        <ProfileSettingsForm userId={userId} user={user} lang={lang} onUserUpdated={onUserUpdated} />
      ) : null}
    </section>
  )
}


