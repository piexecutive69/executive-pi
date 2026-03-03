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

function ensureLink(rel) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
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
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const appLogo = `${origin}/logo_pi.png`
    document.title = pageTitle

    const descTag = ensureMeta('name', 'description')
    descTag.setAttribute('content', description || fallbackDesc)

    const ogTitle = ensureMeta('property', 'og:title')
    ogTitle.setAttribute('content', pageTitle)

    const ogDesc = ensureMeta('property', 'og:description')
    ogDesc.setAttribute('content', description || fallbackDesc)

    const ogType = ensureMeta('property', 'og:type')
    ogType.setAttribute('content', 'website')

    const ogUrl = ensureMeta('property', 'og:url')
    ogUrl.setAttribute('content', currentUrl)

    const ogImage = ensureMeta('property', 'og:image')
    ogImage.setAttribute('content', appLogo)

    const twitterCard = ensureMeta('name', 'twitter:card')
    twitterCard.setAttribute('content', 'summary_large_image')

    const twitterTitle = ensureMeta('name', 'twitter:title')
    twitterTitle.setAttribute('content', pageTitle)

    const twitterDesc = ensureMeta('name', 'twitter:description')
    twitterDesc.setAttribute('content', description || fallbackDesc)

    const twitterImage = ensureMeta('name', 'twitter:image')
    twitterImage.setAttribute('content', appLogo)

    const canonical = ensureLink('canonical')
    canonical.setAttribute('href', currentUrl)

    const favicon = ensureLink('icon')
    favicon.setAttribute('href', '/logo_pi.png')
    favicon.setAttribute('type', 'image/png')

    const appleTouchIcon = ensureLink('apple-touch-icon')
    appleTouchIcon.setAttribute('href', '/logo_pi.png')
  }, [title, description, t, lang])

  return null
}
