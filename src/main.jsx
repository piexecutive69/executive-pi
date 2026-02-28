import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './lib/i18n.jsx'

function bootPiSdkTestnet() {
  if (typeof window === 'undefined') return

  const tryInit = () => {
    if (window.Pi?.init) {
      window.Pi.init({ version: '2.0', sandbox: true })
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

bootPiSdkTestnet()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
