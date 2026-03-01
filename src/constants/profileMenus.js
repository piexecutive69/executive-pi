import { Bell, CircleHelp, FileText, Settings, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react'

export const profileMenus = [
  { key: 'orders', idLabel: 'Pesanan Saya', enLabel: 'My Orders', icon: ShoppingBag },
  { key: 'wishlist', idLabel: 'Wishlist', enLabel: 'Wishlist', icon: UserRound },
  { key: 'notifications', idLabel: 'Notifikasi', enLabel: 'Notifications', icon: Bell },
  { key: 'settings', idLabel: 'Pengaturan', enLabel: 'Settings', icon: Settings },
  { key: 'privacy', idLabel: 'Kebijakan Privasi', enLabel: 'Privacy Policy', icon: ShieldCheck },
  { key: 'terms', idLabel: 'Syarat & Ketentuan', enLabel: 'Terms & Conditions', icon: FileText },
  { key: 'help', idLabel: 'Pusat Bantuan', enLabel: 'Help Center', icon: CircleHelp },
]
