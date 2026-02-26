import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { hasSupabaseEnv, supabase } from './lib/supabase'

const isPiDomainVerified = import.meta.env.VITE_PI_DOMAIN_VERIFIED === 'true'
const piModeEnv = (import.meta.env.VITE_PI_NETWORK_MODE || '').toLowerCase()
const sandboxFlagEnv = import.meta.env.VITE_PI_SANDBOX
const piPaymentAmountEnv = Number(import.meta.env.VITE_PI_PAYMENT_AMOUNT)
const piIdrRateEnv = Number(import.meta.env.VITE_PI_IDR_RATE)
const defaultPiPaymentAmount = Number.isFinite(piPaymentAmountEnv) && piPaymentAmountEnv > 0
  ? piPaymentAmountEnv
  : 0.01
const hasPiIdrRate = Number.isFinite(piIdrRateEnv) && piIdrRateEnv > 0
const explicitSandbox =
  sandboxFlagEnv === 'true' ? true : sandboxFlagEnv === 'false' ? false : null
const defaultPiSandbox = explicitSandbox ?? (piModeEnv !== 'production')

const demoProducts = [
  {
    id: 'demo-1',
    name: 'Tasbih Kayu Premium',
    description: 'Tasbih handmade 99 butir dari kayu sonokeling.',
    category: 'Aksesoris',
    image_url:
      'https://images.unsplash.com/photo-1576504674429-79c3f84f8f9f?auto=format&fit=crop&w=1200&q=80',
    price: 145000,
    stock: 35,
    is_active: true,
  },
  {
    id: 'demo-2',
    name: 'Madu Hutan Sumbawa',
    description: 'Madu murni 500ml, cocok untuk konsumsi harian.',
    category: 'Kesehatan',
    image_url:
      'https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1200&q=80',
    price: 130000,
    stock: 42,
    is_active: true,
  },
  {
    id: 'demo-3',
    name: 'Sarung Tenun Eksklusif',
    description: 'Sarung tenun premium dengan bahan adem dan nyaman.',
    category: 'Fashion',
    image_url:
      'https://images.unsplash.com/photo-1618886487325-f665032b635b?auto=format&fit=crop&w=1200&q=80',
    price: 275000,
    stock: 18,
    is_active: true,
  },
  {
    id: 'demo-4',
    name: 'Kurma Sukari 1kg',
    description: 'Kurma manis grade A, cocok untuk hadiah dan konsumsi.',
    category: 'Makanan',
    image_url:
      'https://images.unsplash.com/photo-1710335141798-331ecfef95c6?auto=format&fit=crop&w=1200&q=80',
    price: 98000,
    stock: 60,
    is_active: true,
  },
]

const newsItems = [
  {
    id: 'n1',
    title: 'Promo Jumat Berkah',
    excerpt: 'Diskon produk pilihan sampai 20% khusus akhir pekan.',
    image:
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'n2',
    title: 'Program UMKM Santri',
    excerpt: 'Produk lokal pesantren kini tersedia lebih lengkap di toko.',
    image:
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=80',
  },
]

const priceFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const formatPrice = (price) => priceFormatter.format(price ?? 0)

const cartStorageKey = 'pi_store_cart_v1'
const piAuthStorageKey = 'pi_store_pi_auth_v1'

const toPiAmount = (idrAmount) => {
  if (hasPiIdrRate) {
    const computed = idrAmount / piIdrRateEnv
    return Math.max(0.001, Number(computed.toFixed(4)))
  }
  return defaultPiPaymentAmount
}

function App() {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(cartStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(hasSupabaseEnv)
  const [guestNotice, setGuestNotice] = useState('')
  const [piReady, setPiReady] = useState(false)
  const [piAuth, setPiAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(piAuthStorageKey)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [piStatus, setPiStatus] = useState('')
  const [piAuthLoading, setPiAuthLoading] = useState(false)
  const [piSandboxMode, setPiSandboxMode] = useState(defaultPiSandbox)

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (piAuth) {
      localStorage.setItem(piAuthStorageKey, JSON.stringify(piAuth))
    } else {
      localStorage.removeItem(piAuthStorageKey)
    }
  }, [piAuth])

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true)
      setFetchError('')

      if (!hasSupabaseEnv) {
        setProducts(demoProducts)
        setLoadingProducts(false)
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, image_url, price, stock, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        setFetchError(`Gagal ambil produk: ${error.message}`)
        setProducts(demoProducts)
      } else {
        setProducts(data?.length ? data : demoProducts)
      }

      setLoadingProducts(false)
    }

    loadProducts()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sandboxParam = new URLSearchParams(window.location.search).get('sandbox')
    const runtimeSandbox =
      sandboxParam === 'true' ? true : sandboxParam === 'false' ? false : defaultPiSandbox
    setPiSandboxMode(runtimeSandbox)

    // Jangan inject sdk eksternal supaya tidak menimpa SDK bawaan Pi Browser.
    if (!window.Pi) {
      setPiReady(false)
      setPiStatus('Pi SDK belum terdeteksi saat init. Kamu tetap bisa klik Login Pi Sandbox untuk retry.')
      return
    }

    try {
      window.Pi.init({ version: '2.0', sandbox: runtimeSandbox })
      setPiReady(true)
      setPiStatus(runtimeSandbox ? 'Pi SDK siap (sandbox mode).' : 'Pi SDK siap (production mode).')
    } catch (error) {
      setPiStatus(`Pi init gagal: ${error?.message || 'unknown error'}`)
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseEnv) return

    const bootstrapAuth = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setAuthLoading(false)
    }

    bootstrapAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const visibleCart = useMemo(() => (session?.user ? cart : []), [session?.user, cart])

  const cartSummary = useMemo(() => {
    const totalItems = visibleCart.reduce((sum, item) => sum + item.quantity, 0)
    const subtotal = visibleCart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    return { totalItems, subtotal }
  }, [visibleCart])

  const addToCart = (product) => {
    if (!session?.user) {
      setGuestNotice('Login dulu untuk menambahkan produk ke cart.')
      return
    }
    setCart((current) => {
      const found = current.find((item) => item.id === product.id)
      if (!found) {
        return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
      }
      return current.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
      )
    })
  }

  const updateQty = (id, quantity) => {
    const safeQty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1
    setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity: safeQty } : item)))
  }

  const removeItem = (id) => {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const logout = async () => {
    if (!hasSupabaseEnv) return
    await supabase.auth.signOut()
    setPiAuth(null)
    setPiStatus('Sesi app logout. Silakan login Pi lagi jika ingin checkout Pi.')
  }

  const persistPiIdentity = async (authRes) => {
    if (!hasSupabaseEnv || !session?.user?.id) return

    const payload = {
      user_id: session.user.id,
      pi_uid: authRes?.user?.uid ?? null,
      pi_username: authRes?.user?.username ?? null,
      pi_access_token: authRes?.accessToken ?? null,
      last_pi_auth_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) {
      setPiStatus(`Pi login berhasil, tapi simpan profile gagal: ${error.message}`)
    }
  }

  const authenticatePi = async () => {
    try {
      setPiAuthLoading(true)
      setPiStatus('Meminta otorisasi Pi...')
      if (!window.Pi) {
        const script = document.createElement('script')
        script.src = 'https://sdk.minepi.com/pi-sdk.js'
        script.async = true
        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.body.appendChild(script)
        })
      }

      if (!window.Pi) {
        throw new Error('Pi SDK belum tersedia di runtime ini.')
      }

      window.Pi.init({ version: '2.0', sandbox: piSandboxMode })
      setPiReady(true)
      const scopes = ['username', 'payments']
      const onIncompletePaymentFound = () => {}
      const authPromise = window.Pi.authenticate(scopes, onIncompletePaymentFound)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout authorize. Pastikan app dibuka via sandbox.minepi.com/app/<app-id>.')), 45000),
      )
      const authRes = await Promise.race([authPromise, timeoutPromise])
      setPiAuth(authRes)
      await persistPiIdentity(authRes)
      setPiStatus(`Pi login sukses: ${authRes?.user?.username || 'unknown user'}`)
    } catch (error) {
      setPiStatus(`Pi login gagal: ${error?.message || 'cancelled/failed'}`)
    } finally {
      setPiAuthLoading(false)
    }
  }

  return (
    <BrowserRouter>
      <div className="mobile-shell">
        <StoreHeader session={session} logout={logout} cartSummary={cartSummary} />

        <main className="mobile-content">
          <Routes>
            <Route
              path="/"
              element={
                <ShopPage
                  products={products}
                  loadingProducts={loadingProducts}
                  fetchError={fetchError}
                  addToCart={addToCart}
                  guestNotice={guestNotice}
                />
              }
            />
            <Route
              path="/news"
              element={<NewsPage />}
            />
            <Route
              path="/cart"
              element={
                <CartPage
                  cart={visibleCart}
                  updateQty={updateQty}
                  removeItem={removeItem}
                  cartSummary={cartSummary}
                  session={session}
                  authLoading={authLoading}
                  piAuth={piAuth}
                />
              }
            />
            <Route
              path="/profile"
              element={
                <ProfilePage
                  session={session}
                  piReady={piReady}
                  piAuth={piAuth}
                  piStatus={piStatus}
                  piAuthLoading={piAuthLoading}
                  piSandboxMode={piSandboxMode}
                  authenticatePi={authenticatePi}
                />
              }
            />
            <Route
              path="/auth"
              element={
                <AuthPage
                  session={session}
                  authLoading={authLoading}
                  piReady={piReady}
                  piAuth={piAuth}
                  piStatus={piStatus}
                  piAuthLoading={piAuthLoading}
                  piSandboxMode={piSandboxMode}
                  authenticatePi={authenticatePi}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <BottomNav session={session} cartSummary={cartSummary} />
      </div>
    </BrowserRouter>
  )
}

function StoreHeader({ session, logout, cartSummary }) {
  return (
    <header className="mobile-header">
      <img src="/brand/pi-executive-logo.png" alt="Pi Executive" className="brand-logo" />
      <div className="brand-text">
        <p className="brand-subtitle">Pi Executive</p>
        <p className="brand-title">Online Store Mobile</p>
      </div>
      <Link to="/cart" className="header-cart" aria-label="Lihat keranjang">
        <CartIcon className="bottom-nav__icon" />
        {!!cartSummary.totalItems && <span className="header-cart__badge">{cartSummary.totalItems}</span>}
      </Link>
      {session?.user && (
        <button type="button" onClick={logout} className="qty-btn" aria-label="Logout">
          <LogoutIcon className="bottom-nav__icon" />
        </button>
      )}
    </header>
  )
}

function BottomNav({ session, cartSummary }) {
  return (
    <nav className="bottom-nav">
      <NavItem to="/" icon={HomeIcon} label="Home" end />
      <NavItem to="/news" icon={NewsIcon} label="News" />
      <NavItem to="/cart" icon={CartIcon} label={`Cart ${cartSummary.totalItems ? cartSummary.totalItems : ''}`.trim()} />
      <NavItem to="/profile" icon={UserIcon} label={session?.user ? 'Profile' : 'Guest'} />
    </nav>
  )
}

function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}>
      {icon({ className: 'bottom-nav__icon' })}
      <span className="bottom-nav__label">{label}</span>
    </NavLink>
  )
}

function ShopPage({ products, loadingProducts, fetchError, addToCart, guestNotice }) {
  const [searchText, setSearchText] = useState('')
  const [category, setCategory] = useState('Semua')

  const categories = useMemo(() => {
    const unique = new Set(products.map((item) => item.category).filter(Boolean))
    return ['Semua', ...unique]
  }, [products])

  const filteredProducts = useMemo(() => {
    const keyword = searchText.toLowerCase().trim()
    return products.filter((item) => {
      const matchCategory = category === 'Semua' || item.category === category
      const matchSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword)
      return matchCategory && matchSearch
    })
  }, [products, searchText, category])

  return (
    <>
      <section className="hero-card">
        <img src="/brand/pi-executive-logo.png" alt="Pi Executive" className="hero-logo" />
        <div>
          <h2>Produk Pilihan</h2>
          <p>Online Store Pesantren</p>
          <small>Core warna Pi Executive + pengalaman mobile app.</small>
        </div>
      </section>

      <section className="section">
        <span className="section-title">Cari Produk</span>
        <div className="filter-grid">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            type="search"
            className="auth-input"
            placeholder="Cari produk..."
          />
          <div className="chips">
            {categories.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                className={`chip${category === option ? ' is-active' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        {!hasSupabaseEnv && (
          <p className="message error">Mode demo aktif. Hubungkan Supabase di file .env untuk data real-time.</p>
        )}
        {guestNotice && <p className="message error">{guestNotice}</p>}
        {fetchError && <p className="message error">{fetchError}</p>}
      </section>

      <section className="section">
        <span className="section-title">Katalog</span>

        {loadingProducts ? (
          <div className="auth-card">
            <p>Memuat katalog produk...</p>
          </div>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <article key={product.id} className="product-card">
                <img src={product.image_url} alt={product.name} className="product-image" loading="lazy" />
                <div className="product-meta">
                  <h3>{product.name}</h3>
                  <p>{product.category}</p>
                  <strong>{formatPrice(product.price)}</strong>
                  <button type="button" className="auth-button" onClick={() => addToCart(product)}>
                    <CartIcon className="bottom-nav__icon" /> Tambah
                  </button>
                </div>
              </article>
            ))}
            {!filteredProducts.length && <div className="auth-card">Produk tidak ditemukan.</div>}
          </div>
        )}
      </section>
    </>
  )
}

function NewsPage() {
  return (
    <section className="section">
      <span className="section-title">News</span>
      <div className="news-grid">
        {newsItems.map((item) => (
          <article key={item.id} className="news-card">
            <img src={item.image} alt={item.title} className="news-image" loading="lazy" />
            <div className="news-meta">
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function CartPage({ cart, updateQty, removeItem, cartSummary, session, authLoading, piAuth }) {
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('manual')
  const [checkoutStatus, setCheckoutStatus] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const accountName = session?.user?.user_metadata?.full_name || ''
  const resolvedBuyerName = buyerName || accountName
  const estimatedPiAmount = toPiAmount(cartSummary.subtotal)

  const syncOrderPayment = async (orderId, payload) => {
    if (!hasSupabaseEnv) return
    await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .eq('user_id', session.user.id)
  }

  const postPiPaymentStep = async (endpoint, payload) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Pi payment server call failed')
    }
    return data
  }

  const runPiPaymentFlow = (order, piAmount) =>
    new Promise((resolve, reject) => {
      if (!window.Pi?.createPayment) {
        reject(new Error('Pi payment SDK tidak tersedia di runtime ini.'))
        return
      }

      const paymentPayload = {
        amount: piAmount,
        memo: `Order ${order.id}`,
        metadata: {
          order_id: order.id,
          buyer_name: resolvedBuyerName,
          user_id: session.user.id,
          total_idr: cartSummary.subtotal,
          pi_amount: piAmount,
        },
      }

      window.Pi.createPayment(paymentPayload, {
        onReadyForServerApproval: async (paymentId) => {
          try {
            await postPiPaymentStep('/api/pi/approve', { paymentId })
            await syncOrderPayment(order.id, {
              payment_reference: `pi_payment:${paymentId}`,
              payment_status: 'awaiting_pi_payment',
            })
          } catch (error) {
            reject(error)
          }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          try {
            await postPiPaymentStep('/api/pi/complete', { paymentId, txid })
            await syncOrderPayment(order.id, {
              payment_reference: `pi_payment:${paymentId}:tx:${txid}`,
              payment_status: 'paid',
              status: 'paid',
            })
            resolve({ paymentId, txid })
          } catch (error) {
            reject(error)
          }
        },
        onCancel: async (paymentId) => {
          await syncOrderPayment(order.id, {
            payment_reference: paymentId ? `pi_payment:${paymentId}` : null,
            payment_status: 'cancelled',
            status: 'cancelled',
          })
          reject(new Error('Pembayaran Pi dibatalkan user.'))
        },
        onError: (error) => {
          reject(new Error(error?.message || 'Pi payment error'))
        },
      })
    })

  if (authLoading) {
    return <section className="auth-card">Memuat autentikasi...</section>
  }

  if (!session?.user) {
    return (
      <section className="section">
        <span className="section-title">Keranjang</span>
        <div className="auth-card">
          <p>Cart kosong untuk guest. Login dulu untuk checkout.</p>
          <Link to="/auth" className="auth-button">Login</Link>
        </div>
      </section>
    )
  }

  const handleCheckout = async (event) => {
    event.preventDefault()

    if (!cart.length) {
      setCheckoutStatus('Keranjang masih kosong.')
      return
    }

    if (!resolvedBuyerName || !buyerPhone || !buyerAddress) {
      setCheckoutStatus('Lengkapi data pembeli terlebih dahulu.')
      return
    }

    if (!hasSupabaseEnv) {
      setCheckoutStatus('Supabase belum diset. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.')
      return
    }

    if (paymentMethod === 'pi' && !isPiDomainVerified) {
      setCheckoutStatus('Domain Pi Network belum tervalidasi. Pakai metode manual dulu.')
      return
    }

    if (paymentMethod === 'pi' && !piAuth?.user?.username) {
      setCheckoutStatus('Login Pi dulu (tombol Login Pi) sebelum checkout dengan pembayaran Pi.')
      return
    }

    setIsCheckingOut(true)
    setCheckoutStatus('Memproses checkout...')

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_name: resolvedBuyerName,
        buyer_phone: buyerPhone,
        buyer_address: buyerAddress,
        user_id: session.user.id,
        total_amount: cartSummary.subtotal,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'manual' ? 'awaiting_manual_payment' : 'awaiting_pi_payment',
        payment_reference: paymentMethod === 'pi' ? `pi:${piAuth?.user?.username || 'pending'}` : null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError) {
      setCheckoutStatus(`Checkout gagal: ${orderError.message}`)
      setIsCheckingOut(false)
      return
    }

    const orderItems = cart.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      setCheckoutStatus(`Order dibuat, tapi item gagal disimpan: ${itemsError.message}`)
      setIsCheckingOut(false)
      return
    }

    if (paymentMethod === 'pi') {
      try {
        setCheckoutStatus(`Order dibuat. Memulai pembayaran ${estimatedPiAmount} PI...`)
        const result = await runPiPaymentFlow(order, estimatedPiAmount)
        setCheckoutStatus(`Pembayaran Pi sukses. Order ${order.id}, tx: ${result.txid}`)
      } catch (error) {
        setCheckoutStatus(`Order ${order.id} dibuat, tapi pembayaran Pi gagal: ${error.message}`)
      }
      setIsCheckingOut(false)
      return
    }

    setCheckoutStatus(`Checkout sukses. ID Order: ${order.id}`)
    setIsCheckingOut(false)
  }

  return (
    <>
      <section className="section">
        <span className="section-title">Keranjang</span>
        <div className="profile-card">
          <div className="profile-avatar">{session.user.email?.[0]?.toUpperCase() ?? 'U'}</div>
          <div>
            <h3>{session.user.email}</h3>
            <p>Cart hanya aktif untuk user login.</p>
          </div>
        </div>

        <div className="list-cards">
          {!cart.length ? (
            <div className="auth-card">Keranjang kamu masih kosong.</div>
          ) : (
            cart.map((item) => (
              <article key={item.id} className="item-card no-image">
                <div className="item-meta">
                  <h3>{item.name}</h3>
                  <p>{formatPrice(item.price)}</p>
                  <div className="qty-row">
                    <button type="button" className="qty-btn" onClick={() => updateQty(item.id, item.quantity - 1)}>
                      <MinusIcon className="bottom-nav__icon" />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button type="button" className="qty-btn" onClick={() => updateQty(item.id, item.quantity + 1)}>
                      <PlusIcon className="bottom-nav__icon" />
                    </button>
                    <button type="button" className="qty-btn danger" onClick={() => removeItem(item.id)}>
                      Hapus
                    </button>
                  </div>
                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="section">
        <span className="section-title">Checkout</span>
        <form className="auth-card" onSubmit={handleCheckout}>
          <p>Total: {formatPrice(cartSummary.subtotal)}</p>
          {paymentMethod === 'pi' && (
            <p>Estimasi bayar Pi: {estimatedPiAmount} PI {hasPiIdrRate ? `(rate ${piIdrRateEnv.toLocaleString('id-ID')} IDR/PI)` : '(pakai nominal default)'}</p>
          )}
          <input
            value={resolvedBuyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            type="text"
            placeholder="Nama pembeli"
            className="auth-input"
          />
          <input
            value={buyerPhone}
            onChange={(event) => setBuyerPhone(event.target.value)}
            type="text"
            placeholder="No. HP"
            className="auth-input"
          />
          <textarea
            value={buyerAddress}
            onChange={(event) => setBuyerAddress(event.target.value)}
            rows={3}
            placeholder="Alamat lengkap"
            className="auth-input"
          />

          <div className="chips">
            <button
              type="button"
              onClick={() => setPaymentMethod('manual')}
              className={`chip${paymentMethod === 'manual' ? ' is-active' : ''}`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('pi')}
              className={`chip${paymentMethod === 'pi' ? ' is-active' : ''}`}
              disabled={!isPiDomainVerified}
            >
              Pi Network
            </button>
          </div>

          <button type="submit" disabled={isCheckingOut} className="auth-button">
            {isCheckingOut ? 'Memproses...' : 'Checkout Sekarang'}
          </button>

          {checkoutStatus && <p className="message success">{checkoutStatus}</p>}
        </form>
      </section>
    </>
  )
}

function AuthPage({ session, authLoading, piReady, piAuth, piStatus, piAuthLoading, authenticatePi, piSandboxMode }) {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (session?.user) {
      navigate('/cart', { replace: true })
    }
  }, [session, navigate])

  const submitAuth = async (event) => {
    event.preventDefault()

    if (!hasSupabaseEnv) {
      setStatus('Supabase belum diset. Login/register tidak tersedia di mode demo.')
      return
    }

    setIsSubmitting(true)
    setStatus('Memproses...')

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })

      if (error) {
        setStatus(`Register gagal: ${error.message}`)
      } else {
        setStatus('Register berhasil. Cek email untuk verifikasi (jika diaktifkan).')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setStatus(`Login gagal: ${error.message}`)
      } else {
        const target = location.state?.from === '/cart' ? '/cart' : '/cart'
        setStatus('Login berhasil. Mengalihkan ke cart...')
        navigate(target, { replace: true })
      }
    }

    setIsSubmitting(false)
  }

  if (authLoading) {
    return <section className="auth-card">Memuat autentikasi...</section>
  }

  return (
    <section className="section">
      <span className="section-title">Autentikasi</span>
      <form className="auth-card" onSubmit={submitAuth}>
        <h3>{mode === 'login' ? 'Login Akun' : 'Buat Akun Baru'}</h3>
        <p>Akun wajib untuk membuka cart dan checkout.</p>

        {mode === 'register' && (
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            type="text"
            placeholder="Nama lengkap"
            className="auth-input"
            required
          />
        )}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          className="auth-input"
          required
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          className="auth-input"
          required
        />

        <button type="submit" disabled={isSubmitting} className="auth-button">
          {isSubmitting ? 'Memproses...' : mode === 'login' ? 'Login Sekarang' : 'Buat Akun'}
        </button>

        {status && <p className="message success">{status}</p>}
      </form>

      <div className="auth-card">
        <h3>Pi Sandbox Login</h3>
        <p>{piReady ? 'SDK terdeteksi.' : 'Menunggu Pi SDK...'}</p>
        <p>Mode: {piSandboxMode ? 'Sandbox' : 'Production'}</p>
        {piAuth?.user?.username && <p>User Pi: {piAuth.user.username}</p>}
        {piStatus && <p>{piStatus}</p>}
        <button type="button" className="auth-button" onClick={authenticatePi} disabled={piAuthLoading}>
          {piAuthLoading ? 'Authorizing...' : 'Login dengan Pi'}
        </button>
      </div>

      <button
        type="button"
        className="auth-button secondary"
        onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
      >
        {mode === 'login' ? 'Belum punya akun? Register' : 'Sudah punya akun? Login'}
      </button>
    </section>
  )
}

function ProfilePage({ session, piAuth, piStatus, piAuthLoading, authenticatePi, piSandboxMode }) {
  if (!session?.user) {
    return (
      <section className="section">
        <span className="section-title">Profile</span>
        <div className="profile-card">
          <div className="profile-avatar">G</div>
          <div>
            <h3>Guest</h3>
            <p>Kamu belum login. Akses cart dan checkout membutuhkan akun.</p>
          </div>
        </div>
        <div className="auth-card">
          <Link to="/auth" className="auth-button">Login / Register</Link>
          <button type="button" className="auth-button secondary" onClick={authenticatePi} disabled={piAuthLoading}>
            {piAuthLoading ? 'Authorizing...' : 'Login Pi Sandbox'}
          </button>
          <p>Mode: {piSandboxMode ? 'Sandbox' : 'Production'}</p>
          {piAuth?.user?.username && <p>Pi User: {piAuth.user.username}</p>}
          {piStatus && <p>{piStatus}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <span className="section-title">Profile</span>
      <div className="profile-card">
        <div className="profile-avatar">{session.user.email?.[0]?.toUpperCase() ?? 'U'}</div>
        <div>
          <h3>{session.user.user_metadata?.full_name || 'User Login'}</h3>
          <p>{session.user.email}</p>
        </div>
      </div>
    </section>
  )
}

function iconProps(className) {
  return {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
  }
}

function HomeIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  )
}

function NewsIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </svg>
  )
}

function CartIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
      <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H7" />
    </svg>
  )
}

function UserIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4 20c1.7-3.3 4.5-5 8-5s6.3 1.7 8 5" />
    </svg>
  )
}

function LogoutIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M9 4H5v16h4" />
      <path d="m14 8 5 4-5 4" />
      <path d="M19 12H9" />
    </svg>
  )
}

function MinusIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M6 12h12" />
    </svg>
  )
}

function PlusIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </svg>
  )
}

export default App
