import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './lib/i18n.jsx'
import { isPiBrowserRequiredHost, isPiSdkEnabledHost, isTokoDomain, resolvePiSandboxModeByHost } from './lib/domainMode.js'

function isPiBrowserClient() {
  if (typeof window === 'undefined') return false
  const ua = String(window.navigator?.userAgent || '').toLowerCase()
  const brands = Array.isArray(window.navigator?.userAgentData?.brands)
    ? window.navigator.userAgentData.brands.map((item) => String(item.brand || '').toLowerCase()).join(' ')
    : ''
  const referrer = String(document.referrer || '').toLowerCase()
  const hasPiReferrer =
    referrer.includes('minepi.com') ||
    referrer.includes('sandbox.minepi.com') ||
    referrer.includes('wallet.pinet.com') ||
    referrer.includes('pinet.com')
  const hasPiQueryFlag =
    String(window.location?.search || '').toLowerCase().includes('pi=') ||
    String(window.location?.search || '').toLowerCase().includes('pi_browser=') ||
    String(window.location?.search || '').toLowerCase().includes('pibrowser=')
  const isAndroidWebView = ua.includes(' wv') || ua.includes('; wv')
  const isMobile = ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')

  return (
    ua.includes('pibrowser') ||
    ua.includes('pi browser') ||
    ua.includes('minepi') ||
    brands.includes('pi') ||
    hasPiReferrer ||
    hasPiQueryFlag ||
    (isAndroidWebView && isMobile)
  )
}

function enforcePiBrowserOnly() {
  if (typeof window === 'undefined') return
  if (!isPiBrowserRequiredHost()) return

  const currentPath = String(window.location?.pathname || '/')
  const isRequiredPage = currentPath === '/pi-browser-required'
  const isPiBrowser = isPiBrowserClient()

  if (!isPiBrowser && !isRequiredPage) {
    window.location.replace('/pi-browser-required')
    return
  }

  if (isPiBrowser && isRequiredPage) {
    window.location.replace('/')
  }
}

function configurePiBrowserUi() {
  if (typeof window === 'undefined') return

  const ua = String(window.navigator?.userAgent || '').toLowerCase()
  const isPiBrowser = isPiBrowserClient()
  const isAndroid = ua.includes('android') || String(window.navigator?.platform || '').toLowerCase().includes('android')
  const root = document.documentElement
  if (isPiBrowser) {
    root.setAttribute('data-pi-browser', 'true')
  }
  if (isAndroid) {
    root.setAttribute('data-android', 'true')
  }
  if (isTokoDomain()) {
    root.setAttribute('data-host-mode', 'toko')
  }

  if (isAndroid) {
    const applyAndroidNavInset = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const chromeInset = Math.max(0, Math.round(window.innerHeight - viewportHeight))
      const boundedInset = Math.min(Math.max(chromeInset, 0), 180)
      root.style.setProperty('--android-nav-inset', `${boundedInset}px`)
    }

    applyAndroidNavInset()
    window.addEventListener('resize', applyAndroidNavInset, { passive: true })
    window.visualViewport?.addEventListener('resize', applyAndroidNavInset, { passive: true })
  }

  const themeColor = '#081633'
  const existing = document.querySelector('meta[name="theme-color"]')
  if (existing) {
    existing.setAttribute('content', themeColor)
  } else {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    meta.setAttribute('content', themeColor)
    document.head.appendChild(meta)
  }
}

function bootPiSdk() {
  if (typeof window === 'undefined') return
  if (!isPiSdkEnabledHost()) return
  const sandbox = resolvePiSandboxModeByHost()

  const tryInit = () => {
    if (window.Pi?.init) {
      window.Pi.init({ version: '2.0', sandbox })
      return true
    }
    return false
  }

  if (tryInit()) return

  const script = document.createElement('script')
  script.src = 'https://sdk.minepi.com/pi-sdk.js'
  script.async = true
  script.onload = () => {
    tryInit()
  }
  document.head.appendChild(script)
}

enforcePiBrowserOnly()
configurePiBrowserUi()
bootPiSdk()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
