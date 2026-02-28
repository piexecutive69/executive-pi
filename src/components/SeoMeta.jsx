import { useEffect } from 'react'
import { useI18n } from '../lib/i18n'

function ensureMeta(attr, key) {
  const selector = `${attr}="${key}"`
  let el = document.head.querySelector(`meta[${selector}]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  return el
}

export default function SeoMeta({ title, description }) {
  const { t, lang } = useI18n()

  useEffect(() => {
    const appName = t('appName')
    const fallbackDesc =
      lang === 'en'
        ? 'Mall Executive PI marketplace for products, PPOB, and digital transactions.'
        : 'Marketplace Mall Executive PI untuk produk, PPOB, dan transaksi digital.'
    const pageTitle = title ? `${title} | ${appName}` : appName
    document.title = pageTitle

    const descTag = ensureMeta('name', 'description')
    descTag.setAttribute('content', description || fallbackDesc)

    const ogTitle = ensureMeta('property', 'og:title')
    ogTitle.setAttribute('content', pageTitle)

    const ogDesc = ensureMeta('property', 'og:description')
    ogDesc.setAttribute('content', description || fallbackDesc)

    const ogType = ensureMeta('property', 'og:type')
    ogType.setAttribute('content', 'website')
  }, [title, description, t, lang])

  return null
}
