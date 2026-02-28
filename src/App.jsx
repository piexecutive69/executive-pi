import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import BottomNav from './components/BottomNav'
import Drawer from './components/Drawer'
import Header from './components/Header'
import ScrollToTop from './components/ScrollToTop'
import { categories as categorySeed, drawerMenus, heroSlides } from './data/storeData'
import { api } from './lib/api'
import CartPage from './pages/CartPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PpobPostpaidCheckPage from './pages/PpobPostpaidCheckPage'
import PpobPrepaidPurchasePage from './pages/PpobPrepaidPurchasePage'
import PpobPage from './pages/PpobPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProfileMenuPage from './pages/ProfileMenuPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'

const SESSION_USER_ID_KEY = 'pi_store_user_id'

export default function App() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setLoading(true)
      setError('')
      try {
        const savedUserId = Number(window.localStorage.getItem(SESSION_USER_ID_KEY) || 0)
        const [productRes, userRes] = await Promise.all([
          api.listProducts({ page: 1, limit: 20 }),
          savedUserId ? api.getUser(savedUserId) : Promise.resolve(null),
        ])
        if (!active) return
        setProducts(productRes.items || [])
        setUser(userRes)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat data backend.')
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [])

  const onLogin = (loginUser) => {
    setUser(loginUser)
    if (loginUser?.id) {
      window.localStorage.setItem(SESSION_USER_ID_KEY, String(loginUser.id))
    }
  }

  const onLogout = () => {
    setUser(null)
    window.localStorage.removeItem(SESSION_USER_ID_KEY)
  }

  const categories = useMemo(() => {
    if (!products.length) return categorySeed
    const names = [...new Set(products.map((item) => item.category_name).filter(Boolean))]
    return names.slice(0, 5).map((name) => ({ name }))
  }, [products])

  const hideBottomNav =
    location.pathname.startsWith('/ppob/prepaid/') ||
    location.pathname.startsWith('/ppob/postpaid/') ||
    location.pathname === '/login' ||
    location.pathname === '/register'

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(1100px_circle_at_12%_8%,#1b2f64_0%,transparent_45%),radial-gradient(860px_circle_at_88%_2%,#274786_0%,transparent_34%),linear-gradient(180deg,#060d23_0%,#050b1c_58%,#040814_100%)]">
      <ScrollToTop />
      <div className="pi-browser-frame min-h-screen w-full bg-[#0a142d]/92 px-4 pb-4 pt-2">
        <Header onOpenDrawer={() => setDrawerOpen(true)} />

        <main className="mt-4">
          {error ? <div className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-[12px] text-red-100">{error}</div> : null}
          <Routes>
            <Route
              path="/"
              element={<HomePage heroSlides={heroSlides} categories={categories} products={products} loading={loading} />}
            />
            <Route path="/ppob" element={<PpobPage userId={user?.id || null} />} />
            <Route path="/ppob/prepaid/:categoryName" element={<PpobPrepaidPurchasePage userId={user?.id || null} />} />
            <Route path="/ppob/postpaid/:brandName" element={<PpobPostpaidCheckPage userId={user?.id || null} />} />
            <Route path="/cart" element={<CartPage userId={user?.id || null} onRefreshUser={setUser} />} />
            <Route path="/profile" element={<ProfilePage user={user} onLogout={onLogout} />} />
            <Route path="/profile/:menuKey" element={<ProfileMenuPage user={user} />} />
            <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/product/:productId" element={<ProductDetailPage userId={user?.id || null} products={products} />} />
          </Routes>
        </main>

        {!hideBottomNav ? <BottomNav /> : null}
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} menus={drawerMenus} />
        <ToastContainer
          position="top-center"
          autoClose={2500}
          hideProgressBar
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable={false}
          theme="dark"
        />
      </div>
    </div>
  )
}
