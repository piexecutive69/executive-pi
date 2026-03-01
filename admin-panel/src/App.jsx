import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiBaseUrl } from './lib/api'

const tabs = ['dashboard', 'products', 'orders', 'wallets', 'digiflazz']
const orderStatuses = ['pending', 'waiting_payment', 'paid', 'cancelled', 'completed']

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

function ProductForm({
  title,
  submitText,
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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-2 md:items-center">
      <form onSubmit={onSubmit} className="soft-card w-full max-w-[620px] rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold">{title}</h3>
          <button type="button" onClick={onCancel} className="rounded-md border border-[#3d5d82] px-2 py-0.5 text-[10px] font-medium">Tutup</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] text-[#9bb0c8]">
            Nama Produk
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
              required
            />
          </label>

          <label className="text-[12px] text-[#9bb0c8]">
            Kategori
            <select
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
              required
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="text-[12px] text-[#9bb0c8]">
            Harga IDR
            <input
              type="number"
              min="0"
              value={form.price_idr}
              onChange={(e) => setForm((p) => ({ ...p, price_idr: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
              required
            />
          </label>

          <label className="text-[12px] text-[#9bb0c8]">
            Harga Pi
            <input
              type="number"
              min="0"
              step="0.0001"
              value={form.price_pi}
              onChange={(e) => setForm((p) => ({ ...p, price_pi: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
            />
          </label>

          <label className="text-[12px] text-[#9bb0c8]">
            Stock
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
              required
            />
          </label>

          <label className="text-[12px] text-[#9bb0c8]">
            Gambar Produk (Upload)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onImageChange}
              className="mt-1 w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
            />
            <span className="mt-1 block text-[11px] text-[#7d98b7]">
              Upload akan menyimpan URL seperti `/assets/img/products/....png`.
            </span>
            {uploadingImage ? <span className="mt-1 block text-[11px] text-cyan-300">Uploading image...</span> : null}
          </label>

          <input
            type="hidden"
            value={form.image_url || ''}
            onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
          />

          <label className="sm:col-span-2 text-[12px] text-[#9bb0c8]">
            Deskripsi
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="mt-1 min-h-[90px] w-full rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"
            />
          </label>

          <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-[#b9cee6]">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            Produk Aktif
          </label>

          {preview ? (
            <div className="sm:col-span-2 rounded-xl border border-[#35557a] bg-[#0b1a2c] p-2">
              <p className="mb-2 text-[11px] text-[#8db0d4]">Preview gambar dari URL database:</p>
              <img src={preview} alt={form.name || 'Preview'} className="max-h-[180px] rounded-lg object-contain" />
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-[#3d5d82] px-2 py-1 text-[10px] font-medium">Batal</button>
          <button type="submit" className="rounded-md bg-cyan-500/85 px-2 py-1 text-[10px] font-medium text-[#032329]">{submitText}</button>
        </div>
      </form>
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
    Promise.all([loadSummary(), loadCategories(), loadProducts(), loadOrders(), loadWallets(), loadLogs()]).catch((e) => setError(e.message || 'Load error'))
  }, [loadSummary, loadCategories, loadProducts, loadOrders, loadWallets, loadLogs])

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
      if (orderDetail?.id === id) setOrderDetail(await api.getOrderDetail(id))
    } catch (e) {
      setError(e.message || 'Update status error')
    }
  }

  const linkedCount = useMemo(() => wallets.filter((x) => x.is_linked).length, [wallets])

  return (
    <div className="admin-shell mx-auto max-w-[1320px] px-4 pb-8 pt-4 text-[#e7f1ff]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-[#7cb0e6]">PI STORE</p>
          <h1 className="text-[28px] font-extrabold">Admin Panel</h1>
          <p className="text-[12px] text-[#88a4c4]">{apiBaseUrl}</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`rounded-full border px-4 py-1.5 text-[12px] ${tab === x ? 'border-cyan-400/50 bg-cyan-500/20' : 'border-[#35557a] bg-[#0f2238]'}`}>{x}</button>
        ))}
      </div>

      {error ? <div className="mb-3 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-[12px]">{error}</div> : null}

      {tab === 'dashboard' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="soft-card rounded-2xl p-4"><p className="text-[12px] text-[#9bb0c8]">Products</p><p className="mt-2 text-[24px] font-bold">{summary?.productsTotal ?? '-'}</p></div><div className="soft-card rounded-2xl p-4"><p className="text-[12px] text-[#9bb0c8]">Orders</p><p className="mt-2 text-[24px] font-bold">{summary?.ordersTotal ?? '-'}</p></div><div className="soft-card rounded-2xl p-4"><p className="text-[12px] text-[#9bb0c8]">Users</p><p className="mt-2 text-[24px] font-bold">{summary?.usersTotal ?? '-'}</p></div><div className="soft-card rounded-2xl p-4"><p className="text-[12px] text-[#9bb0c8]">Paid GMV</p><p className="mt-2 text-[24px] font-bold">{idr(summary?.paidGmvIdr)}</p></div></div> : null}

      {tab === 'products' ? (
        <section className="soft-card rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <input value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Search product" className="min-w-[220px] rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]" />
              <select value={pStatus} onChange={(e) => { setPStatus(e.target.value); setPPage(1) }} className="rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"><option value="all">all</option><option value="active">active</option><option value="inactive">inactive</option></select>
            </div>
            <button onClick={openCreateProduct} className="rounded-md bg-cyan-500/85 px-2 py-1 text-[10px] font-medium text-[#032329]">+ Tambah Produk</button>
          </div>
          <div className="overflow-auto rounded-xl border border-[#2f4e74]"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#10243b] text-[#8fb0d2]"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Image</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Action</th></tr></thead><tbody>{products.map((x) => <tr key={x.id} className="border-t border-[#243f60]"><td className="px-3 py-2">{x.name}<div className="text-[11px] text-[#86a2c0]">#{x.id}</div></td><td className="px-3 py-2">{x.image_url ? <img src={mapAssetUrl(x.image_url)} alt={x.name} className="h-10 w-10 rounded object-cover" /> : '-'}</td><td className="px-3 py-2">{idr(x.price_idr)}</td><td className="px-3 py-2">{x.stock}</td><td className="px-3 py-2">{x.is_active ? 'active' : 'inactive'}</td><td className="px-3 py-2"><button onClick={() => openEditProduct(x)} className="rounded-lg border border-[#3d5d82] bg-[#16304d] px-3 py-1 text-[11px]">edit</button></td></tr>)}</tbody></table></div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#88a4c4]"><span>{pPage}/{pPages}</span><div className="flex gap-2"><button onClick={() => setPPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">prev</button><button onClick={() => setPPage((v) => Math.min(pPages, v + 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">next</button></div></div>
        </section>
      ) : null}

      {tab === 'orders' ? <section className="soft-card rounded-2xl p-4"><div className="mb-3 flex flex-wrap gap-2"><input value={oSearch} onChange={(e) => setOSearch(e.target.value)} placeholder="Search order/user" className="min-w-[220px] flex-1 rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]" /><select value={oStatus} onChange={(e) => { setOStatus(e.target.value); setOPage(1) }} className="rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"><option value="">all</option>{orderStatuses.map((x) => <option key={x} value={x}>{x}</option>)}</select></div><div className="overflow-auto rounded-xl border border-[#2f4e74]"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#10243b] text-[#8fb0d2]"><tr><th className="px-3 py-2">Order</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Detail</th></tr></thead><tbody>{orders.map((x) => <tr key={x.id} className="border-t border-[#243f60]"><td className="px-3 py-2">#{x.id}<div className="text-[11px] text-[#86a2c0]">{dt(x.created_at)}</div></td><td className="px-3 py-2">{x.user_name}<div className="text-[11px] text-[#86a2c0]">{x.user_email}</div></td><td className="px-3 py-2">{idr(x.total_idr)}</td><td className="px-3 py-2"><select value={x.status} onChange={(e) => updateOrderStatus(x.id, e.target.value)} className="rounded-lg border border-[#3d5d82] bg-[#16304d] px-2 py-1 text-[11px]">{orderStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></td><td className="px-3 py-2"><button onClick={async () => setOrderDetail(await api.getOrderDetail(x.id))} className="rounded-lg border border-[#3d5d82] bg-[#16304d] px-3 py-1 text-[11px]">view</button></td></tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-between text-[12px] text-[#88a4c4]"><span>{oPage}/{oPages}</span><div className="flex gap-2"><button onClick={() => setOPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">prev</button><button onClick={() => setOPage((v) => Math.min(oPages, v + 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">next</button></div></div></section> : null}

      {tab === 'wallets' ? <section className="soft-card rounded-2xl p-4"><div className="mb-2 text-[12px] text-[#88a4c4]">Linked this page: {linkedCount}/{wallets.length}</div><div className="mb-3 flex flex-wrap gap-2"><input value={wSearch} onChange={(e) => setWSearch(e.target.value)} placeholder="Search wallet/user" className="min-w-[220px] flex-1 rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]" /><select value={wStatus} onChange={(e) => { setWStatus(e.target.value); setWPage(1) }} className="rounded-xl border border-[#35557a] bg-[#0b1a2c] px-3 py-2 text-[13px]"><option value="all">all</option><option value="linked">linked</option><option value="unlinked">unlinked</option></select></div><div className="overflow-auto rounded-xl border border-[#2f4e74]"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#10243b] text-[#8fb0d2]"><tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Balance</th><th className="px-3 py-2">Pi UID</th><th className="px-3 py-2">Wallet</th></tr></thead><tbody>{wallets.map((x) => <tr key={x.id} className="border-t border-[#243f60]"><td className="px-3 py-2">{x.name}<div className="text-[11px] text-[#86a2c0]">{x.email}</div></td><td className="px-3 py-2">{idr(x.idr_balance)}<div className="text-[11px] text-[#86a2c0]">Pi {Number(x.pi_balance || 0)}</div></td><td className="px-3 py-2">{x.pi_uid || '-'}</td><td className="px-3 py-2 max-w-[280px]"><span className="break-all text-[11px]">{x.wallet_address || '-'}</span></td></tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-between text-[12px] text-[#88a4c4]"><span>{wPage}/{wPages}</span><div className="flex gap-2"><button onClick={() => setWPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">prev</button><button onClick={() => setWPage((v) => Math.min(wPages, v + 1))} className="rounded-lg border border-[#3d5d82] px-3 py-1">next</button></div></div></section> : null}

      {tab === 'digiflazz' ? <section className="soft-card rounded-2xl p-4"><div className="mb-3 flex flex-wrap gap-2"><button onClick={() => runSync('all')} disabled={Boolean(busySync)} className="rounded-xl bg-cyan-500/85 px-4 py-2 text-[12px] font-bold text-[#032329]">{busySync === 'all' ? 'syncing...' : 'sync all'}</button><button onClick={() => runSync('prepaid')} disabled={Boolean(busySync)} className="rounded-xl border border-[#3d5d82] bg-[#16304d] px-4 py-2 text-[12px]">prepaid</button><button onClick={() => runSync('pasca')} disabled={Boolean(busySync)} className="rounded-xl border border-[#3d5d82] bg-[#16304d] px-4 py-2 text-[12px]">pasca</button><button onClick={() => runSync('auto-missing')} disabled={Boolean(busySync)} className="rounded-xl border border-[#3d5d82] bg-[#16304d] px-4 py-2 text-[12px]">auto-missing</button></div>{syncResult ? <pre className="mb-3 overflow-auto rounded-xl border border-[#35557a] bg-[#0b1a2c] p-3 text-[11px] text-[#a7c8e8]">{JSON.stringify(syncResult, null, 2)}</pre> : null}<div className="overflow-auto rounded-xl border border-[#2f4e74]"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#10243b] text-[#8fb0d2]"><tr><th className="px-3 py-2">time</th><th className="px-3 py-2">type</th><th className="px-3 py-2">status</th><th className="px-3 py-2">records</th><th className="px-3 py-2">notes</th></tr></thead><tbody>{logs.map((x) => <tr key={x.id} className="border-t border-[#243f60]"><td className="px-3 py-2">{dt(x.finished_at || x.started_at)}</td><td className="px-3 py-2">{x.sync_type}</td><td className="px-3 py-2">{x.status}</td><td className="px-3 py-2">{Number(x.total_records || 0)}</td><td className="px-3 py-2">{x.notes || '-'}</td></tr>)}</tbody></table></div></section> : null}

      {productMode ? (
        <ProductForm
          title={productMode === 'create' ? 'Tambah Produk' : `Edit Produk #${editingProductId}`}
          submitText="Simpan"
          categories={categories}
          form={productForm}
          setForm={setProductForm}
          onCancel={closeProductModal}
          onSubmit={submitProduct}
          onImageChange={onUploadImage}
          uploadingImage={uploadingImage}
        />
      ) : null}

      {orderDetail ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-2 md:items-center">
          <div className="soft-card w-full max-w-[680px] rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[16px] font-bold">Order #{orderDetail.id}</h3><button onClick={() => setOrderDetail(null)} className="rounded-lg border border-[#3d5d82] px-2 py-1 text-[12px]">close</button></div>
            <div className="mb-3 grid gap-2 text-[12px] sm:grid-cols-2"><p>User: {orderDetail.user_name}</p><p>Status: {orderDetail.status}</p><p>Subtotal: {idr(orderDetail.subtotal_idr)}</p><p>Total: {idr(orderDetail.total_idr)}</p></div>
            <div className="overflow-auto rounded-xl border border-[#2f4e74]"><table className="min-w-full text-left text-[12px]"><thead className="bg-[#10243b] text-[#8fb0d2]"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Total</th></tr></thead><tbody>{(orderDetail.items || []).map((x) => <tr key={x.id} className="border-t border-[#243f60]"><td className="px-3 py-2">{x.product_name}</td><td className="px-3 py-2">{x.qty}</td><td className="px-3 py-2">{idr(x.unit_price_idr)}</td><td className="px-3 py-2">{idr(x.line_total_idr)}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
