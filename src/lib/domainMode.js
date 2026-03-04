function getHost() {
  if (typeof window === 'undefined') return ''
  return String(window.location?.hostname || '').toLowerCase()
}

export function isTokoDomain() {
  return getHost() === 'toko.pi-executive.com'
}

export function isPiBrowserRequiredHost() {
  const host = getHost()
  return host === 'mall.pi-executive.com' || host === 'store.pi-executive.com'
}

export function isPiSdkEnabledHost() {
  return !isTokoDomain()
}

export function resolvePiSandboxModeByHost() {
  const host = getHost()
  if (host === 'store.pi-executive.com') return true
  if (host === 'mall.pi-executive.com') return false
  return false
}
