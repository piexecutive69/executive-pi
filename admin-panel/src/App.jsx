import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiBaseUrl } from './lib/api'

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'wallets', label: 'Pi Wallets' },
  { key: 'digiflazz', label: 'Digiflazz' },
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

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [error, setError] = useState('')

  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])

  const [products, setProducts] = useState([])
  const [pPage, setPPage] = useState(1)
  const [pTotal, setPTotal] = useState(0)
  const [pSearch, setPSearch] = useState('')
  const [pStatus, setPStatus] = useState('all')

  const [orders, setOrders] = useState([])
  const [oPage, setOPage] = useState(1)
  const [oTotal, setOTotal] = useState(0)
  const [oSearch, setOSearch] = useState('')
  const [oStatus, setOStatus] = useState('')
  const [orderDetail, setOrderDetail] = useState(null)

  const [wallets, setWallets] = useState([])
  const [wPage, setWPage] = useState(1)
  const [wTotal, setWTotal] = useState(0)
  const [wSearch, setWSearch] = useState('')
  const [wStatus, setWStatus] = useState('all')

  const [logs, setLogs] = useState([])
  const [syncResult, setSyncResult] = useState(null)
  const [busySync, setBusySync] = useState('')

  const [productMode, setProductMode] = useState('')
  const [productForm, setProductForm] = useState(blankProductForm)
  const [editingProductId, setEditingProductId] = useState(0)
  const [uploadingImage, setUploadingImage] = useState(false)

  const perPage = 10
  const pPages = Math.max(1, Math.ceil(pTotal / perPage))
  const oPages = Math.max(1, Math.ceil(oTotal / perPage))
  const wPages = Math.max(1, Math.ceil(wTotal / perPage))

  const loadSummary = useCallback(async () => setSummary(await api.getSummary()), [])
  const loadCategories = useCallback(async () => setCategories(await api.listProductCategories()), [])

  const loadProducts = useCallback(async () => {
    const r = await api.listProducts({ page: pPage, limit: perPage, search: pSearch, status: pStatus })
    setProducts(r.items || [])
    setPTotal(Number(r.total || 0))
  }, [pPage, pSearch, pStatus])

  const loadOrders = useCallback(async () => {
    const r = await api.listOrders({ page: oPage, limit: perPage, search: oSearch, status: oStatus })
    setOrders(r.items || [])
    setOTotal(Number(r.total || 0))
  }, [oPage, oSearch, oStatus])

  const loadWallets = useCallback(async () => {
    const r = await api.listPiWallets({ page: wPage, limit: perPage, search: wSearch, status: wStatus })
    setWallets(r.items || [])
    setWTotal(Number(r.total || 0))
  }, [wPage, wSearch, wStatus])

  const loadLogs = useCallback(async () => setLogs(await api.listDigiflazzLogs(20)), [])

  useEffect(() => {
    setError('')
    Promise.all([loadSummary(), loadCategories(), loadProducts(), loadOrders(), loadWallets(), loadLogs()]).catch((e) => {
      setError(e.message || 'Load error')
    })
  }, [loadSummary, loadCategories, loadProducts, loadOrders, loadWallets, loadLogs])

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
    } catch (e) {
      setError(e.message || 'Update status error')
    }
  }

  const runSync = async (cmd) => {
    setBusySync(cmd)
    setSyncResult(null)
    try {
      const r = cmd === 'auto-missing' ? await api.autoSyncMissingDigiflazz() : await api.syncDigiflazz(cmd)
      setSyncResult(r)
      await loadLogs()
    } catch (e) {
      setError(e.message || 'Sync error')
    } finally {
      setBusySync('')
    }
  }

  const linkedCount = useMemo(() => wallets.filter((x) => x.is_linked).length, [wallets])

  return (
    <div className="adminlte-shell">
      <aside className="admin-sidebar">
        <div className="mb-5 px-2">
          <p className="text-[11px] tracking-[0.2em] text-[#9fb4cf]">EXECUTIVE PI</p>
          <p className="mt-1 text-[19px] font-bold text-white">AdminLTE Style Panel</p>
          <p className="mt-1 text-[11px] text-[#89a0bd] break-all">{apiBaseUrl}</p>
        </div>

        <nav className="space-y-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`admin-nav-btn ${tab === item.key ? 'admin-nav-btn-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={pSearch}
                    onChange={(e) => setPSearch(e.target.value)}
                    placeholder="Search product"
                    className="admin-input min-w-[220px]"
                  />
                  <select
                    value={pStatus}
                    onChange={(e) => {
                      setPStatus(e.target.value)
                      setPPage(1)
                    }}
                    className="admin-input min-w-[120px]"
                  >
                    <option value="all">all</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <button onClick={openCreateProduct} className="admin-btn admin-btn-primary">+ Tambah Produk</button>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Image</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-[#0f172a]">{item.name}</p>
                          <p className="text-[11px] text-[#64748b]">#{item.id}</p>
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
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>{pPage}/{pPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPPage((v) => Math.max(1, v - 1))} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setPPage((v) => Math.min(pPages, v + 1))} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'orders' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <input
                  value={oSearch}
                  onChange={(e) => setOSearch(e.target.value)}
                  placeholder="Search order/user"
                  className="admin-input min-w-[240px] flex-1"
                />
                <select
                  value={oStatus}
                  onChange={(e) => {
                    setOStatus(e.target.value)
                    setOPage(1)
                  }}
                  className="admin-input min-w-[160px]"
                >
                  <option value="">all</option>
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
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
                          <select value={item.status} onChange={(e) => updateOrderStatus(item.id, e.target.value)} className="admin-input min-w-[140px]">
                            {orderStatuses.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button onClick={async () => setOrderDetail(await api.getOrderDetail(item.id))} className="admin-btn admin-btn-light">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>{oPage}/{oPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setOPage((v) => Math.max(1, v - 1))} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setOPage((v) => Math.min(oPages, v + 1))} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'wallets' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-2 text-[12px] text-[#64748b]">Linked this page: {linkedCount}/{wallets.length}</div>

              <div className="mb-3 flex flex-wrap gap-2">
                <input
                  value={wSearch}
                  onChange={(e) => setWSearch(e.target.value)}
                  placeholder="Search wallet/user"
                  className="admin-input min-w-[240px] flex-1"
                />
                <select
                  value={wStatus}
                  onChange={(e) => {
                    setWStatus(e.target.value)
                    setWPage(1)
                  }}
                  className="admin-input min-w-[160px]"
                >
                  <option value="all">all</option>
                  <option value="linked">linked</option>
                  <option value="unlinked">unlinked</option>
                </select>
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
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12px] text-[#64748b]">
                <span>{wPage}/{wPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setWPage((v) => Math.max(1, v - 1))} className="admin-btn admin-btn-light">Prev</button>
                  <button onClick={() => setWPage((v) => Math.min(wPages, v + 1))} className="admin-btn admin-btn-light">Next</button>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'digiflazz' ? (
            <section className="admin-panel-card p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <button onClick={() => runSync('all')} disabled={Boolean(busySync)} className="admin-btn admin-btn-primary">
                  {busySync === 'all' ? 'Syncing...' : 'Sync All'}
                </button>
                <button onClick={() => runSync('prepaid')} disabled={Boolean(busySync)} className="admin-btn admin-btn-light">Prepaid</button>
                <button onClick={() => runSync('pasca')} disabled={Boolean(busySync)} className="admin-btn admin-btn-light">Pasca</button>
                <button onClick={() => runSync('auto-missing')} disabled={Boolean(busySync)} className="admin-btn admin-btn-light">Auto Missing</button>
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
    </div>
  )
}
