import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mall_executive_pi_lang'

const messages = {
  id: {
    appName: 'Mall Executive PI',
    searchAnything: 'Cari apa saja',
    openMenu: 'Buka menu',
    navHome: 'Beranda',
    navPpob: 'PPOB',
    navCart: 'Keranjang',
    navProfile: 'Profil',
    loginRequiredTitle: 'Silakan login dulu',
    loginRequiredDesc: 'Keranjang dan checkout hanya tersedia setelah login.',
    loginNow: 'Login Sekarang',
    login: 'Login',
    register: 'Daftar',
    loginSuccess: 'Login berhasil.',
    loginFailed: 'Login gagal.',
    registerSuccess: 'Pendaftaran berhasil. Silakan login.',
    registerFailed: 'Daftar gagal.',
    phonePasswordRequired: 'Nomor HP dan password wajib diisi.',
    requiredFields: 'Semua field wajib diisi.',
    minPassword: 'Password minimal 6 karakter.',
  },
  en: {
    appName: 'Mall Executive PI',
    searchAnything: 'Search anything',
    openMenu: 'Open menu',
    navHome: 'Home',
    navPpob: 'PPOB',
    navCart: 'Cart',
    navProfile: 'Profile',
    loginRequiredTitle: 'Please log in first',
    loginRequiredDesc: 'Cart and checkout are available after login.',
    loginNow: 'Login Now',
    login: 'Login',
    register: 'Register',
    loginSuccess: 'Login successful.',
    loginFailed: 'Login failed.',
    registerSuccess: 'Registration successful. Please log in.',
    registerFailed: 'Registration failed.',
    phonePasswordRequired: 'Phone number and password are required.',
    requiredFields: 'All fields are required.',
    minPassword: 'Password must be at least 6 characters.',
  },
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'en' ? 'en' : 'id'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang === 'en' ? 'en' : 'id'
  }, [lang])

  const value = useMemo(() => {
    const t = (key) => messages[lang]?.[key] || messages.id[key] || key
    return {
      lang,
      setLang,
      t,
    }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}

