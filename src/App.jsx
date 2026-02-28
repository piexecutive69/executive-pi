import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Drawer from './components/Drawer'
import Header from './components/Header'
import { categories, drawerMenus, heroSlides, products } from './data/storeData'
import CartPage from './pages/CartPage'
import HomePage from './pages/HomePage'
import PpobPage from './pages/PpobPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(1100px_circle_at_12%_8%,#1b2f64_0%,transparent_45%),radial-gradient(860px_circle_at_88%_2%,#274786_0%,transparent_34%),linear-gradient(180deg,#060d23_0%,#050b1c_58%,#040814_100%)]">
      <div className="min-h-screen w-full bg-[#0a142d]/92 px-4 pb-4 pt-2 md:mx-auto md:max-w-[390px]">
        <Header onOpenDrawer={() => setDrawerOpen(true)} />

        <main className="mt-4">
          <Routes>
            <Route path="/" element={<HomePage heroSlides={heroSlides} categories={categories} products={products} />} />
            <Route path="/ppob" element={<PpobPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </main>

        <BottomNav />
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} menus={drawerMenus} />
      </div>
    </div>
  )
}
