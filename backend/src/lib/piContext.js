function toHost(rawHost) {
  const text = String(rawHost || '').trim().toLowerCase()
  if (!text) return ''
  return text.split(',')[0].trim().split(':')[0]
}

function parseDomains(csv) {
  return String(csv || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function resolvePiNetworkByHost(rawHost) {
  const host = toHost(rawHost)
  const testnetDomains = parseDomains(process.env.PI_TESTNET_DOMAINS || 'store.pi-executive.com')
  const mainnetDomains = parseDomains(process.env.PI_MAINNET_DOMAINS || 'mall.pi-executive.com')

  if (host && testnetDomains.includes(host)) return 'testnet'
  if (host && mainnetDomains.includes(host)) return 'mainnet'

  const fallback = String(process.env.PI_CHAIN_NETWORK || 'mainnet').trim().toLowerCase()
  return fallback === 'testnet' ? 'testnet' : 'mainnet'
}

export function resolvePiContextFromRequest(request) {
  const rawHost =
    request?.headers?.['x-forwarded-host'] ||
    request?.headers?.host ||
    request?.hostname ||
    ''
  const host = toHost(rawHost)
  const network = resolvePiNetworkByHost(host)

  const apiKey =
    network === 'testnet'
      ? String(process.env.PI_PLATFORM_API_KEY_TESTNET || process.env.PI_PLATFORM_API_KEY || '').trim()
      : String(process.env.PI_PLATFORM_API_KEY_MAINNET || process.env.PI_PLATFORM_API_KEY || '').trim()

  if (!apiKey) {
    throw new Error(
      network === 'testnet'
        ? 'PI_PLATFORM_API_KEY_TESTNET (or PI_PLATFORM_API_KEY) must be set in .env'
        : 'PI_PLATFORM_API_KEY_MAINNET (or PI_PLATFORM_API_KEY) must be set in .env',
    )
  }

  return {
    host,
    network,
    apiKey,
  }
}

