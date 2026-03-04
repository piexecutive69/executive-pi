import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Blocks, Box, ClipboardList, Eye, LayoutDashboard, PackagePlus, RefreshCw, Settings, Users, WalletCards } from 'lucide-react'
import { api, apiBaseUrl } from './lib/api'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Box },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'wallets', label: 'Pi Wallets', icon: WalletCards },
  { key: 'digiflazz', label: 'Digiflazz', icon: Blocks },
  { key: 'config', label: 'System Config', icon: Settings },
]

const orderStatuses = ['pending', 'waiting_payment', 'paid', 'cancelled', 'completed']

const blankProductForm = {
  name: '',
  description: '',
  price_idr: 0,
  price_pi: 0,
  stock: 0,
  category_id: '',
  image_url: '',
  is_active: true,
}

const idr = (v) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(v || 0))

const dt = (v) => (v ? new Date(v).toLocaleString('id-ID') : '-')
const pageSizeOptions = [5, 10, 25, 50]
const DIGIFLAZZ_SYNC_COOLDOWN_MS = 5 * 60 * 1000

const getPageMeta = (page, limit, total) => {
  const safeTotal = Number(total || 0)
  if (!safeTotal) return { from: 0, to: 0 }
  const from = (Number(page || 1) - 1) * Number(limit || 10) + 1
  const to = Math.min(from + Number(limit || 10) - 1, safeTotal)
  return { from, to }
}

const sortRows = (rows, key, direction) => {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = a?.[key]
    const bv = b?.[key]
    const aNum = Number(av)
    const bNum = Number(bv)
    const bothNumber = Number.isFinite(aNum) && Number.isFinite(bNum)
    if (bothNumber) return (aNum - bNum) * sign
    return String(av ?? '').localeCompare(String(bv ?? ''), 'id', { sensitivity: 'base' }) * sign
  })
}

const getSyncTimestamp = (item) => {
  const raw = item?.finished_at || item?.started_at || item?.created_at
  const ts = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(ts) ? ts : 0
}

const normalizeSyncType = (value) => {
  const v = String(value || '').toLowerCase()
  if (v.includes('prepaid')) return 'prepaid'
  if (v.includes('pasca') || v.includes('postpaid')) return 'pasca'
  return ''
}
const isMemberLevel = (code) => String(code || '').trim().toLowerCase() === 'member'

function normalizeConfigPayload(data) {
  const levels = Array.isArray(data?.levels)
    ? data.levels.map((level) => ({
        level_id: Number(level.level_id || 0),
        code: String(level.code || ''),
        display_name: String(level.display_name || level.code || ''),
        sort_order: Number(level.sort_order || 0),
        is_active: Boolean(level.level_is_active),
        upgrade_fee_idr: Number(level.upgrade_fee_idr || 0),
        upgrade_fee_pi: Number(level.upgrade_fee_pi || 0),
      }))
    : []

  const gateways = Array.isArray(data?.gateways)
    ? data.gateways.map((item) => ({
        code: String(item.code || ''),
        name: String(item.name || item.code || ''),
        is_active: Boolean(item.is_active),
      }))
    : []

  const markups = levels.length
    ? levels.flatMap((level) => {
        const levelId = Number(level.level_id || 0)
        const base = {
          level_id: levelId,
          level_code: String(level.code || ''),
          level_name: String(level.display_name || level.code || ''),
        }
        const source = (data?.levels || []).find((x) => Number(x.level_id) === levelId) || {}
        return [
          {
            ...base,
            product_type: 'prepaid',
            markup_mode: String(source?.prepaid_markup?.markup_mode || 'fixed'),
            markup_idr: Number(source?.prepaid_markup?.markup_idr || 0),
            min_markup_idr: Number(source?.prepaid_markup?.min_markup_idr || 0),
            is_active: Boolean(source?.prepaid_markup?.is_active ?? true),
          },
          {
            ...base,
            product_type: 'postpaid',
            markup_mode: String(source?.postpaid_markup?.markup_mode || 'fixed'),
            markup_idr: Number(source?.postpaid_markup?.markup_idr || 0),
            min_markup_idr: Number(source?.postpaid_markup?.min_markup_idr || 0),
            is_active: Boolean(source?.postpaid_markup?.is_active ?? true),
          },
        ]
      })
    : []

  const bonusesRaw = Array.isArray(data?.bonuses) ? data.bonuses : []
  const bonusMap = new Map(
    bonusesRaw.map((item) => [
      `${Number(item.for_level_id || 0)}:${String(item.rule_type || '')}:${Number(item.depth || 1)}`,
      item,
    ]),
  )
  const bonuses = []
  for (const level of levels) {
    for (const ruleType of ['transaction_bonus', 'upgrade_bonus']) {
      const depthOptions = ruleType === 'upgrade_bonus' ? [1] : [1, 2, 3]
      for (const depth of depthOptions) {
        const found = bonusMap.get(`${level.level_id}:${ruleType}:${depth}`)
        bonuses.push({
          id: Number(found?.id || 0),
          for_level_id: level.level_id,
          level_code: level.code,
          level_name: level.display_name,
          rule_type: ruleType,
          depth,
          bonus_mode: String(found?.bonus_mode || 'fixed'),
          bonus_value: Number(found?.bonus_value || 0),
          bonus_currency: 'idr',
          is_active: Boolean(found?.is_active ?? true),
        })
      }
    }
  }

  const physicalMarkup = data?.physical_markup && typeof data.physical_markup === 'object'
    ? {
        markup_mode: String(data.physical_markup.markup_mode || 'fixed'),
        markup_value: Number(data.physical_markup.markup_value || 0),
        min_markup_idr: Number(data.physical_markup.min_markup_idr || 0),
        is_active: Boolean(data.physical_markup.is_active ?? true),
      }
    : {
        markup_mode: 'fixed',
        markup_value: 0,
        min_markup_idr: 0,
        is_active: true,
      }

  return { gateways, levels, markups, bonuses, physical_markup: physicalMarkup }
}

function mapAssetUrl(imageUrl = '') {
  if (!imageUrl) return ''
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl
  return `${apiBaseUrl}${String(imageUrl).startsWith('/') ? '' : '/'}${imageUrl}`
}

function ProductForm({
  title,
  categories,
  form,
  setForm,
  onCancel,
  onSubmit,
  onImageChange,
  uploadingImage,
}) {
  const preview = mapAssetUrl(form.image_url)

  return (
    <div className="admin-modal">
      <form onSubmit={onSubmit} className="admin-panel-card w-full max-w-[760px] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#d9e2ef] pb-3">
          <h3 className="text-[18px] font-semibold text-[#0f172a]">{title}</h3>
          <button type="button" onClick={onCancel} className="admin-btn admin-btn-light">Close</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="admin-field-label">
            Nama Produk
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="admin-input"
              required
            />
          </label>

          <label className="admin-field-label">
            Kategori
            <select
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
              className="admin-input"
              required
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="admin-field-label">
            Harga IDR
            <input
              type="number"
              min="0"
              value={form.price_idr}
              onChange={(e) => setForm((p) => ({ ...p, price_idr: e.target.value }))}
              className="admin-input"
              required
            />
          </label>

          <label className="admin-field-label">
            Harga PI
            <input
              type="number"
              min="0"
              step="0.0001"
              value={form.price_pi}
              onChange={(e) => setForm((p) => ({ ...p, price_pi: e.target.value }))}
              className="admin-input"
            />
          </label>

          <label className="admin-field-label">
            Stock
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
              className="admin-input"
              required
            />
          </label>

          <label className="admin-field-label">
            Upload Gambar
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onImageChange}
              className="admin-input"
            />
            <span className="mt-1 block text-[11px] text-[#64748b]">URL akan tersimpan otomatis.</span>
            {uploadingImage ? <span className="mt-1 block text-[11px] text-[#2563eb]">Uploading...</span> : null}
          </label>

          <label className="admin-field-label md:col-span-2">
            Deskripsi
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="admin-input min-h-[120px]"
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-[#334155] md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Produk Aktif
          </label>

          {preview ? (
            <div className="md:col-span-2 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-3">
              <p className="mb-2 text-[12px] text-[#475569]">Preview</p>
              <img src={preview} alt={form.name || 'Preview'} className="max-h-[180px] rounded-lg object-contain" />
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-[#d9e2ef] pt-4">
          <button type="button" onClick={onCancel} className="admin-btn admin-btn-light">Batal</button>
          <button type="submit" className="admin-btn admin-btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  )
}

function OrderDetailModal({ detail, onClose }) {
  if (!detail) return null

  const txid = detail.pi_txid || '-'
  const explorerUrl = detail.pi_txid ? `https://blockexplorer.minepi.com/mainnet/tx/${detail.pi_txid}` : ''

  return (
    <div className="admin-modal">
      <div className="admin-panel-card w-full max-w-[860px] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#d9e2ef] pb-3">
          <h3 className="text-[18px] font-semibold text-[#0f172a]">Order #{detail.id}</h3>
          <button onClick={onClose} className="admin-btn admin-btn-light">Close</button>
        </div>

        <div className="mb-4 grid gap-2 text-[13px] text-[#334155] md:grid-cols-2">
          <p>User: <span className="font-medium">{detail.user_name || detail.user_id}</span></p>
          <p>Status: <span className="font-medium uppercase">{detail.status}</span></p>
          <p>Payment Method: <span className="font-medium">{detail.payment_method || '-'}</span></p>
          <p>Payment ID: <span className="font-medium break-all">{detail.pi_payment_identifier || '-'}</span></p>
          <p className="md:col-span-2">TxID: <span className="font-medium break-all">{txid}</span></p>
          {explorerUrl ? (
            <p className="md:col-span-2">
              Explorer:{' '}
              <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-medium text-[#2563eb] underline">
                Open blockchain transaction
              </a>
            </p>
          ) : null}
          <p>Subtotal: <span className="font-medium">{idr(detail.subtotal_idr)}</span></p>
          <p>Total: <span className="font-medium">{idr(detail.total_idr)}</span></p>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(detail.items || []).map((item) => (
                <tr key={item.id || `${item.product_id}-${item.product_name}`}>
                  <td>{item.product_name}</td>
                  <td>{item.qty}</td>
                  <td>{idr(item.unit_price_idr)}</td>
                  <td>{idr(item.line_total_idr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserDetailModal({ detail, onClose }) {
  if (!detail) return null

  return (
    <div className="admin-modal">
      <div className="admin-panel-card w-full max-w-[880px] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#d9e2ef] pb-3">
          <h3 className="text-[18px] font-semibold text-[#0f172a]">User Detail</h3>
          <button onClick={onClose} className="admin-btn admin-btn-light">Close</button>
        </div>

        <div className="grid gap-2 text-[13px] text-[#334155] md:grid-cols-2">
          <p>Name: <span className="font-medium">{detail.name || '-'}</span></p>
          <p>Status: <span className="font-medium uppercase">{detail.status || '-'}</span></p>
          <p>Email: <span className="font-medium">{detail.email || '-'}</span></p>
          <p>Phone: <span className="font-medium">{detail.phone || '-'}</span></p>
          <p>IDR Balance: <span className="font-medium">{idr(detail.idr_balance)}</span></p>
          <p>PI Balance: <span className="font-medium">{Number(detail.pi_balance || 0)}</span></p>
          <p>Membership: <span className="font-medium">{detail.membership_name || '-'}</span></p>
          <p>Pi UID: <span className="font-medium break-all">{detail.pi_uid || '-'}</span></p>
          <p className="md:col-span-2">Wallet Address: <span className="font-medium break-all">{detail.wallet_address || '-'}</span></p>
          <p className="md:col-span-2">
            Address: <span className="font-medium">
              {detail.address
                ? [
                    detail.address.address_line,
                    detail.address.village_name,
                    detail.address.district_name,
                    detail.address.regency_name,
                    detail.address.province_name,
                    detail.address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(', ')
                : '-'}
            </span>
          </p>
          <p>Total Orders: <span className="font-medium">{Number(detail.order_summary?.total_orders || 0)}</span></p>
          <p>Paid Total: <span className="font-medium">{idr(detail.order_summary?.paid_total_idr || 0)}</span></p>
        </div>

        <div className="mt-4">
          <h4 className="mb-2 text-[14px] font-semibold text-[#0f172a]">Recent Orders</h4>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(detail.recent_orders || []).map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.status}</td>
                    <td>{idr(order.total_idr)}</td>
                    <td>{order.payment_method || '-'}</td>
                    <td>{dt(order.created_at)}</td>
                  </tr>
                ))}
                {!detail.recent_orders?.length ? (
                  <tr>
                    <td colSpan={5} className="text-center text-[12px] text-[#64748b]">No recent orders.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])

  const [products, setProducts] = useState([])
  const [pPage, setPPage] = useState(1)
  const [pTotal, setPTotal] = useState(0)
  const [pSearch, setPSearch] = useState('')
  const [pStatus, setPStatus] = useState('all')
  const [pLimit, setPLimit] = useState(10)
  const [pSort, setPSort] = useState({ key: 'id', dir: 'desc' })

  const [orders, setOrders] = useState([])
  const [oPage, setOPage] = useState(1)
  const [oTotal, setOTotal] = useState(0)
  const [oSearch, setOSearch] = useState('')
  const [oStatus, setOStatus] = useState('')
  const [oLimit, setOLimit] = useState(10)
  const [orderDetail, setOrderDetail] = useState(null)

  const [users, setUsers] = useState([])
  const [uPage, setUPage] = useState(1)
  const [uTotal, setUTotal] = useState(0)
  const [uSearch, setUSearch] = useState('')
  const [uStatus, setUStatus] = useState('all')
  const [uLimit, setULimit] = useState(10)
  const [userDetail, setUserDetail] = useState(null)
  const [busyUserStatusId, setBusyUserStatusId] = useState(0)

  const [wallets, setWallets] = useState([])
  const [wPage, setWPage] = useState(1)
  const [wTotal, setWTotal] = useState(0)
  const [wSearch, setWSearch] = useState('')
  const [wStatus, setWStatus] = useState('all')
  const [wLimit, setWLimit] = useState(10)

  const [logs, setLogs] = useState([])
  const [syncResult, setSyncResult] = useState(null)
  const [busySync, setBusySync] = useState('')
  const [configForm, setConfigForm] = useState({
    gateways: [],
    levels: [],
    markups: [],
    bonuses: [],
    physical_markup: { markup_mode: 'fixed', markup_value: 0, min_markup_idr: 0, is_active: true },
  })
  const [busyConfigSave, setBusyConfigSave] = useState(false)
  const [configSection, setConfigSection] = useState('gateway')
  const [markupTab, setMarkupTab] = useState('prepaid')
  const [bonusTab, setBonusTab] = useState('transaction_bonus')

  const [productMode, setProductMode] = useState('')
  const [productForm, setProductForm] = useState(blankProductForm)
  const [editingProductId, setEditingProductId] = useState(0)
  const [uploadingImage, setUploadingImage] = useState(false)

  const pPages = Math.max(1, Math.ceil(pTotal / pLimit))
  const oPages = Math.max(1, Math.ceil(oTotal / oLimit))
  const uPages = Math.max(1, Math.ceil(uTotal / uLimit))
  const wPages = Math.max(1, Math.ceil(wTotal / wLimit))
  const pMeta = getPageMeta(pPage, pLimit, pTotal)
  const oMeta = getPageMeta(oPage, oLimit, oTotal)
  const uMeta = getPageMeta(uPage, uLimit, uTotal)
  const wMeta = getPageMeta(wPage, wLimit, wTotal)

  const loadSummary = useCallback(async () => setSummary(await api.getSummary()), [])
  const loadCategories = useCallback(async () => setCategories(await api.listProductCategories()), [])
  const showSuccessToast = useCallback((message) => {
    setToast({ id: Date.now(), message })
  }, [])

  const loadProducts = useCallback(async () => {
    const r = await api.listProducts({ page: pPage, limit: pLimit, search: pSearch, status: pStatus })
    setProducts(r.items || [])
    setPTotal(Number(r.total || 0))
  }, [pPage, pLimit, pSearch, pStatus])

  const loadOrders = useCallback(async () => {
    const r = await api.listOrders({ page: oPage, limit: oLimit, search: oSearch, status: oStatus })
    setOrders(r.items || [])
    setOTotal(Number(r.total || 0))
  }, [oPage, oLimit, oSearch, oStatus])

  const loadUsers = useCallback(async () => {
    const r = await api.listUsers({ page: uPage, limit: uLimit, search: uSearch, status: uStatus })
    setUsers(r.items || [])
    setUTotal(Number(r.total || 0))
  }, [uPage, uLimit, uSearch, uStatus])

  const loadWallets = useCallback(async () => {
    const r = await api.listPiWallets({ page: wPage, limit: wLimit, search: wSearch, status: wStatus })
    setWallets(r.items || [])
    setWTotal(Number(r.total || 0))
  }, [wPage, wLimit, wSearch, wStatus])

  const loadLogs = useCallback(async () => {
    const rows = await api.listDigiflazzLogs(20)
    setLogs(Array.isArray(rows) ? rows : [])
  }, [])
  const loadSystemConfig = useCallback(async () => {
    const config = await api.getSystemConfig()
    setConfigForm(normalizeConfigPayload(config))
  }, [])

  useEffect(() => {
    setError('')
    Promise.all([loadSummary(), loadCategories(), loadProducts(), loadOrders(), loadUsers(), loadWallets(), loadLogs(), loadSystemConfig()]).catch((e) => {
      setError(e.message || 'Load error')
    })
  }, [loadSummary, loadCategories, loadProducts, loadOrders, loadUsers, loadWallets, loadLogs, loadSystemConfig])

  useEffect(() => {
    if (!toast?.id) return undefined
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const openCreateProduct = () => {
    setProductMode('create')
    setEditingProductId(0)
    setProductForm(blankProductForm)
  }

  const openEditProduct = (item) => {
    setProductMode('edit')
    setEditingProductId(Number(item.id))
    setProductForm({
      name: item.name || '',
      description: item.description || '',
      price_idr: Number(item.price_idr || 0),
      price_pi: Number(item.price_pi || 0),
      stock: Number(item.stock || 0),
      category_id: String(item.category_id || ''),
      image_url: item.image_url || '',
      is_active: Boolean(item.is_active),
    })
  }

  const closeProductModal = () => {
    setProductMode('')
    setEditingProductId(0)
    setProductForm(blankProductForm)
  }

  const onUploadImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const uploaded = await api.uploadProductImage({
        file,
        previousImageUrl: productMode === 'edit' ? productForm.image_url : '',
      })
      setProductForm((prev) => ({ ...prev, image_url: uploaded.imageUrl || '' }))
    } catch (e) {
      setError(e.message || 'Gagal upload gambar')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const submitProduct = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        name: productForm.name,
        description: productForm.description,
        price_idr: Number(productForm.price_idr || 0),
        price_pi: Number(productForm.price_pi || 0),
        stock: Number(productForm.stock || 0),
        category_id: Number(productForm.category_id || 0),
        image_url: productForm.image_url || null,
        is_active: Boolean(productForm.is_active),
      }

      if (productMode === 'create') {
        await api.createProduct(payload)
      } else {
        await api.updateProduct(editingProductId, payload)
      }

      closeProductModal()
      await Promise.all([loadProducts(), loadSummary()])
      showSuccessToast(productMode === 'create' ? 'Produk berhasil ditambahkan.' : 'Produk berhasil diperbarui.')
    } catch (e) {
      setError(e.message || 'Gagal simpan produk')
    }
  }

  const updateOrderStatus = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status)
      await loadOrders()
      if (orderDetail?.id === id) {
        setOrderDetail(await api.getOrderDetail(id))
      }
      showSuccessToast('Status order berhasil diperbarui.')
    } catch (e) {
      setError(e.message || 'Update status error')
    }
  }

  const updateUserStatus = async (id, status) => {
    try {
      setBusyUserStatusId(Number(id))
      await api.updateUserStatus(id, status)
      await loadUsers()
      if (userDetail?.id === id) {
        setUserDetail(await api.getUserDetail(id))
      }
      showSuccessToast('Status user berhasil diperbarui.')
    } catch (e) {
      setError(e.message || 'Update status user error')
    } finally {
      setBusyUserStatusId(0)
    }
  }

  const lastProductSync = useMemo(() => {
    const candidates = logs.filter((item) => ['prepaid', 'pasca'].includes(normalizeSyncType(item.sync_type)))
    if (!candidates.length) return null
    return [...candidates].sort((a, b) => getSyncTimestamp(b) - getSyncTimestamp(a))[0]
  }, [logs])
  const syncCooldownRemainingMs = useMemo(() => {
    if (!lastProductSync) return 0
    const elapsed = Date.now() - getSyncTimestamp(lastProductSync)
    return Math.max(0, DIGIFLAZZ_SYNC_COOLDOWN_MS - elapsed)
  }, [lastProductSync, logs])
  const syncCooldownRemainingMin = Math.ceil(syncCooldownRemainingMs / 60000)

  const runSync = async (cmd) => {
    const normalizedCmd = String(cmd || '').toLowerCase()
    if (!['prepaid', 'pasca'].includes(normalizedCmd)) {
      setError('Jenis sinkronisasi tidak valid.')
      return
    }
    if (
      lastProductSync &&
      normalizeSyncType(lastProductSync.sync_type) !== normalizedCmd &&
      syncCooldownRemainingMs > 0
    ) {
      setError(`Jeda minimal 5 menit antar Prepaid dan Pasca. Tunggu ${syncCooldownRemainingMin} menit lagi.`)
      return
    }

    setBusySync(cmd)
    setSyncResult(null)
    try {
      const r = await api.syncDigiflazz(cmd)
      setSyncResult(r)
      await loadLogs()
      showSuccessToast(`Sync ${normalizedCmd.toUpperCase()} berhasil.`)
    } catch (e) {
      setError(e.message || 'Sync error')
    } finally {
      setBusySync('')
    }
  }

  const updateGatewayConfig = (code, nextActive) => {
    setConfigForm((prev) => ({
      ...prev,
      gateways: prev.gateways.map((item) =>
        item.code === code ? { ...item, is_active: Boolean(nextActive) } : item,
      ),
    }))
  }

  const updateMarkupConfig = (levelId, productType, key, value) => {
    setConfigForm((prev) => ({
      ...prev,
      markups: prev.markups.map((item) => {
        if (Number(item.level_id) !== Number(levelId) || item.product_type !== productType) return item
        return { ...item, [key]: value }
      }),
    }))
  }

  const updateLevelConfig = (levelId, key, value) => {
    setConfigForm((prev) => ({
      ...prev,
      levels: prev.levels.map((item) => (Number(item.level_id) === Number(levelId) ? { ...item, [key]: value } : item)),
    }))
  }

  const updateBonusConfig = (levelId, ruleType, depth, key, value) => {
    setConfigForm((prev) => ({
      ...prev,
      bonuses: prev.bonuses.map((item) => {
        if (
          Number(item.for_level_id) !== Number(levelId) ||
          item.rule_type !== ruleType ||
          Number(item.depth) !== Number(depth)
        ) {
          return item
        }
        return { ...item, [key]: value }
      }),
    }))
  }

  const updatePhysicalMarkupConfig = (key, value) => {
    setConfigForm((prev) => ({
      ...prev,
      physical_markup: {
        ...(prev.physical_markup || { markup_mode: 'fixed', markup_value: 0, min_markup_idr: 0, is_active: true }),
        [key]: value,
      },
    }))
  }

  const saveSystemConfig = async () => {
    setBusyConfigSave(true)
    setError('')
    try {
      const payload = {
        gateways: configForm.gateways.map((item) => ({
          code: item.code,
          is_active: Boolean(item.is_active),
        })),
        levels: configForm.levels.map((item) => ({
          level_id: Number(item.level_id),
          upgrade_fee_idr: Number(item.upgrade_fee_idr || 0),
          upgrade_fee_pi: Number(item.upgrade_fee_pi || 0),
          is_active: Boolean(item.is_active),
        })),
        markups: configForm.markups.map((item) => ({
          level_id: Number(item.level_id),
          product_type: item.product_type,
          markup_mode: item.markup_mode,
          markup_idr: Number(item.markup_idr || 0),
          min_markup_idr: Number(item.min_markup_idr || 0),
          is_active: Boolean(item.is_active),
        })),
        bonuses: configForm.bonuses.map((item) => ({
          id: Number(item.id || 0),
          for_level_id: Number(item.for_level_id),
          rule_type: item.rule_type,
          depth: item.rule_type === 'upgrade_bonus' ? 1 : Number(item.depth),
          bonus_mode: item.bonus_mode,
          bonus_value: Number(item.bonus_value || 0),
          bonus_currency: item.bonus_currency,
          is_active: Boolean(item.is_active),
        })),
        physical_markup: {
          markup_mode: configForm.physical_markup?.markup_mode || 'fixed',
          markup_value: Number(configForm.physical_markup?.markup_value || 0),
          min_markup_idr: Number(configForm.physical_markup?.min_markup_idr || 0),
          is_active: Boolean(configForm.physical_markup?.is_active),
        },
      }
      await api.updateSystemConfig(payload)
      await loadSystemConfig()
      showSuccessToast('System config berhasil disimpan.')
    } catch (e) {
      setError(e.message || 'Gagal simpan system config')
    } finally {
      setBusyConfigSave(false)
    }
  }

  const linkedCount = useMemo(() => wallets.filter((x) => x.is_linked).length, [wallets])
  const sortedProducts = useMemo(() => sortRows(products, pSort.key, pSort.dir), [products, pSort])
  const filteredMarkups = useMemo(
    () => configForm.markups.filter((item) => item.product_type === markupTab),
    [configForm.markups, markupTab],
  )
  const filteredBonuses = useMemo(
    () =>
      configForm.bonuses.filter(
        (item) =>
          item.rule_type === bonusTab &&
          !isMemberLevel(item.level_code) &&
          (bonusTab !== 'upgrade_bonus' || Number(item.depth) === 1),
      ),
    [configForm.bonuses, bonusTab],
  )
  const upgradeLevels = useMemo(
    () => configForm.levels.filter((item) => !isMemberLevel(item.code)),
    [configForm.levels],
  )

  const toggleProductSort = (key) => {
    setPSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }

  const renderSortIcon = (key) => {
    if (pSort.key !== key) return <ArrowUpDown className="h-3.5 w-3.5" />
    if (pSort.dir === 'asc') return <ArrowUp className="h-3.5 w-3.5" />
    return <ArrowDown className="h-3.5 w-3.5" />
  }
  const isSyncBlocked = (targetType) => {
    if (!lastProductSync) return false
    const lastType = normalizeSyncType(lastProductSync.sync_type)
    return lastType !== targetType && syncCooldownRemainingMs > 0
  }

  return (
    <div className="adminlte-shell">
      <aside className="admin-sidebar">
        <div className="mb-5 px-2">
          <p className="text-[11px] tracking-[0.2em] text-[#9fb4cf]">EXECUTIVE PI</p>
          <p className="mt-1 text-[19px] font-bold text-white">Admin Panel</p>
          <p className="mt-1 text-[11px] text-[#89a0bd] break-all">AdminLTE style interface</p>
        </div>

        <nav className="space-y-1">
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`admin-nav-btn ${tab === item.key ? 'admin-nav-btn-active' : ''}`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0f172a]">{tabs.find((x) => x.key === tab)?.label || 'Dashboard'}</h1>
            <p className="text-[12px] text-[#64748b]">Control products, orders, wallets, and sync tools.</p>
          </div>
        </header>

        <main className="space-y-4">
          {error ? <div className="admin-alert">{error}</div> : null}

          {tab === 'dashboard' ? (
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="admin-stat-card">
                <p className="admin-stat-label">Products</p>
                <p className="admin-stat-value">{summary?.productsTotal ?? '-'}</p>
              </div>
              <div className="admin-stat-card">
                <p className="admin-stat-label">Orders</p>
                <p className="admin-stat-value">{summary?.ordersTotal ?? '-'}</p>
              </div>
              <div className="admin-stat-card">
                <p className="admin-stat-label">Users</p>
                <p className="admin-stat-value">{summary?.usersTotal ?? '-'}</p>
              </div>
              <div className="admin-stat-card">
                <p className="admin-stat-label">Paid GMV</p>
                <p className="admin-stat-value">{idr(summary?.paidGmvIdr)}</p>
              </div>
            </section>
          ) : null}

          {tab === 'products' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="datatable-toolbar-left">
                  <label className="datatable-label">
                    Show
                    <select
                      value={pLimit}
                      onChange={(e) => {
                        setPLimit(Number(e.target.value))
                        setPPage(1)
                      }}
                      className="admin-input min-w-[84px]"
                    >
                      {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    entries
                  </label>
                  <label className="datatable-label">
                    Status
                    <select
                      value={pStatus}
                      onChange={(e) => {
                        setPStatus(e.target.value)
                        setPPage(1)
                      }}
                      className="admin-input min-w-[120px]"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <button onClick={openCreateProduct} className="admin-btn admin-btn-primary">
                  <span className="inline-flex items-center gap-1.5">
                    <PackagePlus className="h-3.5 w-3.5" />
                    <span>Tambah Produk</span>
                  </span>
                </button>
                <label className="datatable-search">
                  Search:
                  <input
                    value={pSearch}
                    onChange={(e) => {
                      setPSearch(e.target.value)
                      setPPage(1)
                    }}
                    placeholder="Nama produk..."
                    className="admin-input min-w-[220px]"
                  />
                </label>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" onClick={() => toggleProductSort('name')} className="admin-th-btn">
                          <span>Name</span>
                          {renderSortIcon('name')}
                        </button>
                      </th>
                      <th>Image</th>
                      <th>
                        <button type="button" onClick={() => toggleProductSort('price_idr')} className="admin-th-btn">
                          <span>Price</span>
                          {renderSortIcon('price_idr')}
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleProductSort('stock')} className="admin-th-btn">
                          <span>Stock</span>
                          {renderSortIcon('stock')}
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => toggleProductSort('is_active')} className="admin-th-btn">
                          <span>Status</span>
                          {renderSortIcon('is_active')}
                        </button>
                      </th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-[#0f172a]">{item.name}</p>
                        </td>
                        <td>
                          {item.image_url ? (
                            <img src={mapAssetUrl(item.image_url)} alt={item.name} className="h-10 w-10 rounded object-cover" />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{idr(item.price_idr)}</td>
                        <td>{item.stock}</td>
                        <td>
                          <span className={`admin-pill ${item.is_active ? 'admin-pill-success' : 'admin-pill-muted'}`}>
                            {item.is_active ? 'active' : 'inactive'}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => openEditProduct(item)} className="admin-btn admin-btn-light">Edit</button>
                        </td>
                      </tr>
                    ))}
                    {!products.length ? (
                      <tr>
                        <td colSpan={6} className="text-center text-[12px] text-[#64748b]">No product data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>Showing {pMeta.from} to {pMeta.to} of {pTotal} entries</span>
                <div className="flex gap-2">
                  <span className="admin-page-indicator">{pPage}/{pPages}</span>
                  <button onClick={() => setPPage((v) => Math.max(1, v - 1))} disabled={pPage <= 1} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setPPage((v) => Math.min(pPages, v + 1))} disabled={pPage >= pPages} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'orders' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="datatable-toolbar-left">
                  <label className="datatable-label">
                    Show
                    <select
                      value={oLimit}
                      onChange={(e) => {
                        setOLimit(Number(e.target.value))
                        setOPage(1)
                      }}
                      className="admin-input min-w-[84px]"
                    >
                      {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    entries
                  </label>
                  <label className="datatable-label">
                    Status
                    <select
                      value={oStatus}
                      onChange={(e) => {
                        setOStatus(e.target.value)
                        setOPage(1)
                      }}
                      className="admin-input min-w-[160px]"
                    >
                      <option value="">All</option>
                      {orderStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="datatable-search">
                  Search:
                  <input
                    value={oSearch}
                    onChange={(e) => {
                      setOSearch(e.target.value)
                      setOPage(1)
                    }}
                    placeholder="Order / User"
                    className="admin-input min-w-[260px]"
                  />
                </label>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>User</th>
                      <th>Total</th>
                      <th>Payment ID</th>
                      <th>TxID</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-[#0f172a]">#{item.id}</p>
                          <p className="text-[11px] text-[#64748b]">{dt(item.created_at)}</p>
                        </td>
                        <td>
                          <p className="font-medium text-[#0f172a]">{item.user_name}</p>
                          <p className="text-[11px] text-[#64748b]">{item.user_email}</p>
                        </td>
                        <td>{idr(item.total_idr)}</td>
                        <td className="max-w-[160px]"><span className="break-all text-[11px]">{item.pi_payment_identifier || '-'}</span></td>
                        <td className="max-w-[170px]">
                          {item.pi_txid ? (
                            <a
                              className="break-all text-[11px] text-[#2563eb] underline"
                              href={`https://blockexplorer.minepi.com/mainnet/tx/${item.pi_txid}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.pi_txid}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <select
                            value={item.status}
                            onChange={(e) => updateOrderStatus(item.id, e.target.value)}
                            disabled={String(item.payment_method || '').toLowerCase() === 'pi_sdk'}
                            className="admin-input min-w-[140px]"
                            title={String(item.payment_method || '').toLowerCase() === 'pi_sdk' ? 'Status order Pi SDK tidak bisa diubah manual' : ''}
                          >
                            {orderStatuses.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button onClick={async () => setOrderDetail(await api.getOrderDetail(item.id))} className="admin-btn admin-btn-light">
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!orders.length ? (
                      <tr>
                        <td colSpan={7} className="text-center text-[12px] text-[#64748b]">No order data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>Showing {oMeta.from} to {oMeta.to} of {oTotal} entries</span>
                <div className="flex gap-2">
                  <span className="admin-page-indicator">{oPage}/{oPages}</span>
                  <button onClick={() => setOPage((v) => Math.max(1, v - 1))} disabled={oPage <= 1} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setOPage((v) => Math.min(oPages, v + 1))} disabled={oPage >= oPages} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'users' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="datatable-toolbar-left">
                  <label className="datatable-label">
                    Show
                    <select
                      value={uLimit}
                      onChange={(e) => {
                        setULimit(Number(e.target.value))
                        setUPage(1)
                      }}
                      className="admin-input min-w-[84px]"
                    >
                      {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    entries
                  </label>
                  <label className="datatable-label">
                    Status
                    <select
                      value={uStatus}
                      onChange={(e) => {
                        setUStatus(e.target.value)
                        setUPage(1)
                      }}
                      className="admin-input min-w-[140px]"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <label className="datatable-search">
                  Search:
                  <input
                    value={uSearch}
                    onChange={(e) => {
                      setUSearch(e.target.value)
                      setUPage(1)
                    }}
                    placeholder="Name / Email / Phone"
                    className="admin-input min-w-[260px]"
                  />
                </label>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Contact</th>
                      <th>Membership</th>
                      <th>Balance</th>
                      <th>Pi Wallet</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-[#0f172a]">{item.name}</p>
                        </td>
                        <td>
                          <p className="text-[12px]">{item.email || '-'}</p>
                          <p className="text-[11px] text-[#64748b]">{item.phone || '-'}</p>
                        </td>
                        <td>
                          <p className="font-medium">{item.membership_name || '-'}</p>
                          <p className="text-[11px] text-[#64748b]">{item.membership_code || '-'}</p>
                        </td>
                        <td>
                          <p>{idr(item.idr_balance)}</p>
                          <p className="text-[11px] text-[#64748b]">PI {Number(item.pi_balance || 0)}</p>
                        </td>
                        <td>
                          <p className="text-[11px] break-all">{item.wallet_address || '-'}</p>
                          <p className="text-[11px] text-[#64748b]">{item.pi_uid || '-'}</p>
                        </td>
                        <td>
                          <select
                            value={item.status || 'inactive'}
                            disabled={busyUserStatusId === Number(item.id)}
                            onChange={(e) => updateUserStatus(item.id, e.target.value)}
                            className="admin-input min-w-[120px]"
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </td>
                        <td>
                          <button onClick={async () => setUserDetail(await api.getUserDetail(item.id))} className="admin-btn admin-btn-light">
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" />
                              <span>Detail</span>
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!users.length ? (
                      <tr>
                        <td colSpan={7} className="text-center text-[12px] text-[#64748b]">No user data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>Showing {uMeta.from} to {uMeta.to} of {uTotal} entries</span>
                <div className="flex gap-2">
                  <span className="admin-page-indicator">{uPage}/{uPages}</span>
                  <button onClick={() => setUPage((v) => Math.max(1, v - 1))} disabled={uPage <= 1} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setUPage((v) => Math.min(uPages, v + 1))} disabled={uPage >= uPages} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'wallets' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-2 text-[12px] text-[#64748b]">Linked this page: {linkedCount}/{wallets.length}</div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="datatable-toolbar-left">
                  <label className="datatable-label">
                    Show
                    <select
                      value={wLimit}
                      onChange={(e) => {
                        setWLimit(Number(e.target.value))
                        setWPage(1)
                      }}
                      className="admin-input min-w-[84px]"
                    >
                      {pageSizeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    entries
                  </label>
                  <label className="datatable-label">
                    Status
                    <select
                      value={wStatus}
                      onChange={(e) => {
                        setWStatus(e.target.value)
                        setWPage(1)
                      }}
                      className="admin-input min-w-[160px]"
                    >
                      <option value="all">All</option>
                      <option value="linked">Linked</option>
                      <option value="unlinked">Unlinked</option>
                    </select>
                  </label>
                </div>
                <label className="datatable-search">
                  Search:
                  <input
                    value={wSearch}
                    onChange={(e) => {
                      setWSearch(e.target.value)
                      setWPage(1)
                    }}
                    placeholder="Wallet / User"
                    className="admin-input min-w-[260px]"
                  />
                </label>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Balance</th>
                      <th>Pi UID</th>
                      <th>Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-[#0f172a]">{item.name}</p>
                          <p className="text-[11px] text-[#64748b]">{item.email}</p>
                        </td>
                        <td>
                          <p>{idr(item.idr_balance)}</p>
                          <p className="text-[11px] text-[#64748b]">Pi {Number(item.pi_balance || 0)}</p>
                        </td>
                        <td><span className="break-all">{item.pi_uid || '-'}</span></td>
                        <td className="max-w-[280px]"><span className="break-all text-[11px]">{item.wallet_address || '-'}</span></td>
                      </tr>
                    ))}
                    {!wallets.length ? (
                      <tr>
                        <td colSpan={4} className="text-center text-[12px] text-[#64748b]">No wallet data.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>Showing {wMeta.from} to {wMeta.to} of {wTotal} entries</span>
                <div className="flex gap-2">
                  <span className="admin-page-indicator">{wPage}/{wPages}</span>
                  <button onClick={() => setWPage((v) => Math.max(1, v - 1))} disabled={wPage <= 1} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setWPage((v) => Math.min(wPages, v + 1))} disabled={wPage >= wPages} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'config' ? (
            <section className="space-y-4">
              <div className="config-tabs">
                <button onClick={() => setConfigSection('gateway')} className={`config-tab-btn ${configSection === 'gateway' ? 'config-tab-btn-active' : ''}`}>Gateway</button>
                <button onClick={() => setConfigSection('markup')} className={`config-tab-btn ${configSection === 'markup' ? 'config-tab-btn-active' : ''}`}>Markup</button>
                <button onClick={() => setConfigSection('upgrade')} className={`config-tab-btn ${configSection === 'upgrade' ? 'config-tab-btn-active' : ''}`}>Upgrade</button>
                <button onClick={() => setConfigSection('bonus')} className={`config-tab-btn ${configSection === 'bonus' ? 'config-tab-btn-active' : ''}`}>Bonus</button>
              </div>

              {configSection === 'gateway' ? (
                <div className="admin-panel-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#0f172a]">Payment Gateways</h3>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table min-w-[620px]">
                      <thead>
                        <tr><th>Gateway</th><th>Code</th><th>Active</th></tr>
                      </thead>
                      <tbody>
                        {configForm.gateways.map((item) => (
                          <tr key={item.code}>
                            <td>{item.name}</td>
                            <td>{item.code}</td>
                            <td>
                              <label className="inline-flex items-center gap-2 text-[12px]">
                                <input type="checkbox" checked={Boolean(item.is_active)} onChange={(e) => updateGatewayConfig(item.code, e.target.checked)} />
                                <span>{item.is_active ? 'Active' : 'Inactive'}</span>
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {configSection === 'markup' ? (
                <div className="admin-panel-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#0f172a]">Global Markup Config</h3>
                    <p className="text-[12px] text-[#64748b]">Digiflazz + Produk Fisik</p>
                  </div>
                  <div className="config-tabs mb-3">
                    <button onClick={() => setMarkupTab('prepaid')} className={`config-tab-btn ${markupTab === 'prepaid' ? 'config-tab-btn-active' : ''}`}>Prepaid</button>
                    <button onClick={() => setMarkupTab('postpaid')} className={`config-tab-btn ${markupTab === 'postpaid' ? 'config-tab-btn-active' : ''}`}>Postpaid</button>
                    <button onClick={() => setMarkupTab('physical')} className={`config-tab-btn ${markupTab === 'physical' ? 'config-tab-btn-active' : ''}`}>Produk Fisik</button>
                  </div>

                  {markupTab === 'physical' ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="admin-field-label">Mode
                        <select value={configForm.physical_markup?.markup_mode || 'fixed'} onChange={(e) => updatePhysicalMarkupConfig('markup_mode', e.target.value)} className="admin-input">
                          <option value="fixed">fixed</option>
                          <option value="percentage">percentage</option>
                        </select>
                      </label>
                      <label className="admin-field-label">Markup Value
                        <input type="number" min="0" value={configForm.physical_markup?.markup_value ?? 0} onChange={(e) => updatePhysicalMarkupConfig('markup_value', e.target.value)} className="admin-input" />
                      </label>
                      <label className="admin-field-label">Min Markup IDR
                        <input type="number" min="0" value={configForm.physical_markup?.min_markup_idr ?? 0} onChange={(e) => updatePhysicalMarkupConfig('min_markup_idr', e.target.value)} className="admin-input" />
                      </label>
                      <label className="admin-field-label">Active
                        <select value={configForm.physical_markup?.is_active ? '1' : '0'} onChange={(e) => updatePhysicalMarkupConfig('is_active', e.target.value === '1')} className="admin-input">
                          <option value="1">active</option>
                          <option value="0">inactive</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table min-w-[920px]">
                        <thead>
                          <tr><th>Level</th><th>Mode</th><th>Markup (IDR)</th><th>Min Markup (IDR)</th><th>Active</th></tr>
                        </thead>
                        <tbody>
                          {filteredMarkups.map((item, idx) => (
                            <tr key={`${item.level_id}-${item.product_type}-${idx}`}>
                              <td><p className="font-medium text-[#0f172a]">{item.level_name}</p><p className="text-[11px] text-[#64748b]">{item.level_code}</p></td>
                              <td><select value={item.markup_mode} onChange={(e) => updateMarkupConfig(item.level_id, item.product_type, 'markup_mode', e.target.value)} className="admin-input min-w-[120px]"><option value="fixed">fixed</option><option value="percentage">percentage</option></select></td>
                              <td><input type="number" min="0" value={item.markup_idr} onChange={(e) => updateMarkupConfig(item.level_id, item.product_type, 'markup_idr', e.target.value)} className="admin-input min-w-[140px]" /></td>
                              <td><input type="number" min="0" value={item.min_markup_idr} onChange={(e) => updateMarkupConfig(item.level_id, item.product_type, 'min_markup_idr', e.target.value)} className="admin-input min-w-[140px]" /></td>
                              <td><label className="inline-flex items-center gap-2 text-[12px]"><input type="checkbox" checked={Boolean(item.is_active)} onChange={(e) => updateMarkupConfig(item.level_id, item.product_type, 'is_active', e.target.checked)} /><span>{item.is_active ? 'Active' : 'Inactive'}</span></label></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {configSection === 'upgrade' ? (
                <div className="admin-panel-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#0f172a]">Membership Upgrade Config</h3>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table min-w-[760px]">
                      <thead><tr><th>Level</th><th>Upgrade Fee IDR</th><th>Upgrade Fee PI</th><th>Active</th></tr></thead>
                      <tbody>
                        {upgradeLevels.map((item) => (
                          <tr key={`level-${item.level_id}`}>
                            <td><p className="font-medium text-[#0f172a]">{item.display_name}</p><p className="text-[11px] text-[#64748b]">{item.code}</p></td>
                            <td><input type="number" min="0" value={item.upgrade_fee_idr} onChange={(e) => updateLevelConfig(item.level_id, 'upgrade_fee_idr', e.target.value)} className="admin-input min-w-[150px]" /></td>
                            <td><input type="number" min="0" step="0.0001" value={item.upgrade_fee_pi} onChange={(e) => updateLevelConfig(item.level_id, 'upgrade_fee_pi', e.target.value)} className="admin-input min-w-[150px]" /></td>
                            <td><label className="inline-flex items-center gap-2 text-[12px]"><input type="checkbox" checked={Boolean(item.is_active)} onChange={(e) => updateLevelConfig(item.level_id, 'is_active', e.target.checked)} /><span>{item.is_active ? 'Active' : 'Inactive'}</span></label></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {configSection === 'bonus' ? (
                <div className="admin-panel-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-[#0f172a]">Affiliate Bonus Rules</h3>
                    <p className="text-[12px] text-[#64748b]">
                      {bonusTab === 'upgrade_bonus' ? 'Upgrade bonus: sekali, depth 1 saja' : 'Depth 1-3'}
                    </p>
                  </div>
                  <div className="config-tabs mb-3">
                    <button onClick={() => setBonusTab('transaction_bonus')} className={`config-tab-btn ${bonusTab === 'transaction_bonus' ? 'config-tab-btn-active' : ''}`}>Transaction Bonus</button>
                    <button onClick={() => setBonusTab('upgrade_bonus')} className={`config-tab-btn ${bonusTab === 'upgrade_bonus' ? 'config-tab-btn-active' : ''}`}>Upgrade Bonus</button>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table min-w-[980px]">
                      <thead><tr><th>Level</th><th>Depth</th><th>Mode</th><th>Value</th><th>Currency</th><th>Active</th></tr></thead>
                      <tbody>
                        {filteredBonuses.map((item, idx) => (
                          <tr key={`bonus-${item.for_level_id}-${item.rule_type}-${item.depth}-${idx}`}>
                            <td><p className="font-medium text-[#0f172a]">{item.level_name}</p><p className="text-[11px] text-[#64748b]">{item.level_code}</p></td>
                            <td>
                              {item.rule_type === 'upgrade_bonus' ? (
                                <span className="text-[13px] font-medium text-[#0f172a]">1</span>
                              ) : (
                                <select value={item.depth} onChange={(e) => updateBonusConfig(item.for_level_id, item.rule_type, item.depth, 'depth', Number(e.target.value))} className="admin-input min-w-[90px]"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select>
                              )}
                            </td>
                            <td><select value={item.bonus_mode} onChange={(e) => updateBonusConfig(item.for_level_id, item.rule_type, item.depth, 'bonus_mode', e.target.value)} className="admin-input min-w-[130px]"><option value="fixed">fixed</option><option value="percentage">percentage</option></select></td>
                            <td><input type="number" min="0" step="0.0001" value={item.bonus_value} onChange={(e) => updateBonusConfig(item.for_level_id, item.rule_type, item.depth, 'bonus_value', e.target.value)} className="admin-input min-w-[130px]" /></td>
                              <td><select value="idr" disabled className="admin-input min-w-[110px]"><option value="idr">idr</option></select></td>
                            <td><label className="inline-flex items-center gap-2 text-[12px]"><input type="checkbox" checked={Boolean(item.is_active)} onChange={(e) => updateBonusConfig(item.for_level_id, item.rule_type, item.depth, 'is_active', e.target.checked)} /><span>{item.is_active ? 'Active' : 'Inactive'}</span></label></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                <button onClick={saveSystemConfig} disabled={busyConfigSave} className="admin-btn admin-btn-primary">
                  {busyConfigSave ? 'Saving...' : 'Simpan System Config'}
                </button>
              </div>
            </section>
          ) : null}

          {tab === 'digiflazz' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={() => runSync('prepaid')} disabled={Boolean(busySync) || isSyncBlocked('prepaid')} className="admin-btn admin-btn-primary">
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${busySync === 'prepaid' ? 'animate-spin' : ''}`} />
                    <span>{busySync === 'prepaid' ? 'Syncing...' : 'Sync Prepaid'}</span>
                  </span>
                </button>
                <button onClick={() => runSync('pasca')} disabled={Boolean(busySync) || isSyncBlocked('pasca')} className="admin-btn admin-btn-light">Pasca</button>
              </div>
              <div className="mb-3 text-[12px] text-[#64748b]">
                {lastProductSync ? (
                  <>
                    Last sync: <span className="font-semibold text-[#334155]">{normalizeSyncType(lastProductSync.sync_type).toUpperCase() || '-'}</span> ({dt(lastProductSync.finished_at || lastProductSync.started_at)})
                    {syncCooldownRemainingMs > 0 ? (
                      <span> | Jeda antar tipe sync: {syncCooldownRemainingMin} menit lagi</span>
                    ) : (
                      <span> | Siap untuk sync tipe berikutnya</span>
                    )}
                  </>
                ) : (
                  <span>Belum ada log sync produk Digiflazz.</span>
                )}
              </div>

              {syncResult ? (
                <pre className="mb-3 overflow-auto rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-3 text-[11px] text-[#0f172a]">
                  {JSON.stringify(syncResult, null, 2)}
                </pre>
              ) : null}

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Records</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((item) => (
                      <tr key={item.id}>
                        <td>{dt(item.finished_at || item.started_at)}</td>
                        <td>{item.sync_type}</td>
                        <td>{item.status}</td>
                        <td>{Number(item.total_records || 0)}</td>
                        <td>{item.notes || '-'}</td>
                      </tr>
                    ))}
                    {!logs.length ? (
                      <tr>
                        <td colSpan={5} className="text-center text-[12px] text-[#64748b]">No sync logs.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {productMode ? (
        <ProductForm
          title={productMode === 'create' ? 'Tambah Produk' : `Edit Produk #${editingProductId}`}
          categories={categories}
          form={productForm}
          setForm={setProductForm}
          onCancel={closeProductModal}
          onSubmit={submitProduct}
          onImageChange={onUploadImage}
          uploadingImage={uploadingImage}
        />
      ) : null}

      <OrderDetailModal detail={orderDetail} onClose={() => setOrderDetail(null)} />
      <UserDetailModal detail={userDetail} onClose={() => setUserDetail(null)} />
      {toast ? (
        <div className="admin-toast">
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="admin-toast-close">x</button>
        </div>
      ) : null}
    </div>
  )
}
