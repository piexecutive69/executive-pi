function resolveApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_BASE_URL
  if (explicit) return explicit

  if (typeof window === 'undefined') {
    return 'http://localhost:3100'
  }

  const { hostname, origin } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3100'
  }

  return origin
}

const API_BASE_URL = resolveApiBaseUrl()
const API_KEY = import.meta.env.VITE_API_KEY || 'pi-store-local-dev-key'
const DEFAULT_USER_ID = Number(import.meta.env.VITE_DEFAULT_USER_ID || 1)
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return API_BASE_URL
  }
})()

function toQueryString(query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function request(path, { method = 'GET', query, body } = {}) {
  const url = `${API_BASE_URL}${path}${toQueryString(query)}`
  const hasBody = body !== undefined && body !== null
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {
    'x-api-key': API_KEY,
  }
  if (!isFormData && hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    throw new Error(`Failed to fetch API: ${url}`)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.message || `Request failed (${response.status})`
    throw new Error(message)
  }
  return data
}

export const apiDefaultUserId = DEFAULT_USER_ID
export const apiBaseUrl = API_BASE_URL
export const apiOrigin = API_ORIGIN

export function toApiAssetUrl(assetPath) {
  if (!assetPath) return ''
  if (/^https?:\/\//i.test(assetPath)) return assetPath
  return `${API_ORIGIN}${String(assetPath).startsWith('/') ? '' : '/'}${assetPath}`
}

export const api = {
  getUser(userId = DEFAULT_USER_ID) {
    return request(`/api/users/${userId}`)
  },

  getUserProfile(userId = DEFAULT_USER_ID) {
    return request(`/api/users/${userId}/profile`)
  },

  updateUserProfile(userId = DEFAULT_USER_ID, payload = {}) {
    return request(`/api/users/${userId}/profile`, {
      method: 'PATCH',
      body: payload,
    })
  },

  uploadUserProfileImage(userId = DEFAULT_USER_ID, file) {
    const formData = new FormData()
    formData.append('image', file)
    return request(`/api/users/${userId}/profile-image`, {
      method: 'POST',
      body: formData,
    })
  },

  updateUserPassword(userId = DEFAULT_USER_ID, { newPassword }) {
    return request(`/api/users/${userId}/password`, {
      method: 'PATCH',
      body: { newPassword },
    })
  },

  getUserAddress(userId = DEFAULT_USER_ID) {
    return request(`/api/users/${userId}/address`)
  },

  upsertUserAddress(userId = DEFAULT_USER_ID, payload = {}) {
    return request(`/api/users/${userId}/address`, {
      method: 'PUT',
      body: payload,
    })
  },

  loginByPhone({ phone, password, piAuth = null }) {
    return request('/api/users/login', {
      method: 'POST',
      body: { phone, password, piAuth },
    })
  },

  loginWithPiSdk({ uid, username = null, accessToken = null, walletAddress = null, piBalance = null }) {
    return request('/api/users/pi-auth', {
      method: 'POST',
      body: { uid, username, accessToken, walletAddress, piBalance },
    })
  },

  syncPiBalance(userId = DEFAULT_USER_ID, { accessToken, uid = null, username = null, walletAddress = null, walletSecretId = null }) {
    return request(`/api/users/${userId}/pi-balance/sync`, {
      method: 'POST',
      body: { accessToken, uid, username, walletAddress, walletSecretId },
    })
  },

  listAdminPiWallets({ page = 1, limit = 20, status = 'all', search = '' } = {}) {
    return request('/api/users/pi-wallets', {
      query: { page, limit, status, search },
    })
  },

  createUser({ name, email, phone, password, piAuth = null }) {
    return request('/api/users', {
      method: 'POST',
      body: { name, email, phone, password, piAuth },
    })
  },

  listProducts(params = {}) {
    return request('/api/products', { query: params })
  },

  getProduct(productId) {
    return request(`/api/products/${productId}`)
  },

  getCart(userId = DEFAULT_USER_ID) {
    return request('/api/cart', { query: { userId } })
  },

  addCartItem({ userId = DEFAULT_USER_ID, productId, qty = 1 }) {
    return request('/api/cart/items', {
      method: 'POST',
      body: { userId, productId, qty },
    })
  },

  updateCartItem({ itemId, userId = DEFAULT_USER_ID, qty }) {
    return request(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      body: { userId, qty },
    })
  },

  deleteCartItem({ itemId, userId = DEFAULT_USER_ID }) {
    return request(`/api/cart/items/${itemId}`, {
      method: 'DELETE',
      query: { userId },
    })
  },

  checkout({ userId = DEFAULT_USER_ID, paymentMethod = 'wallet_idr', shippingAddress = 'Alamat belum diisi' }) {
    return request('/api/orders/checkout', {
      method: 'POST',
      body: { userId, paymentMethod, shippingAddress },
    })
  },

  listOrders(userId = DEFAULT_USER_ID) {
    return request('/api/orders', { query: { userId } })
  },

  getWalletBalance(userId = DEFAULT_USER_ID) {
    return request('/api/wallet/balance', { query: { userId } })
  },

  topupWalletDuitku({ userId = DEFAULT_USER_ID, amountIdr, adminFeeIdr = 0 }) {
    return request('/api/wallet/topup/duitku', {
      method: 'POST',
      body: { userId, amountIdr, adminFeeIdr },
    })
  },

  listPpobServices() {
    return request('/api/ppob/services')
  },

  listProvinces() {
    return request('/api/wilayah/provinces')
  },

  listRegencies(provinceId) {
    return request('/api/wilayah/regencies', { query: { provinceId } })
  },

  listDistricts(regencyId) {
    return request('/api/wilayah/districts', { query: { regencyId } })
  },

  listVillages(districtId) {
    return request('/api/wilayah/villages', { query: { districtId } })
  },

  listDigiflazzProducts({ type = 'prepaid', userId = null, page = 1, limit = 30, search = '', brand = '', category = '' } = {}) {
    return request('/api/digiflazz/products', {
      query: { type, userId, page, limit, search, brand, category },
    })
  },

  listDigiflazzFacets() {
    return request('/api/digiflazz/facets')
  },

  syncDigiflazzPriceList(cmd = 'all') {
    return request('/api/digiflazz/sync/price-list', {
      method: 'POST',
      body: { cmd, dryRun: false },
    })
  },

  listDigiflazzSyncLogs(limit = 20) {
    return request('/api/digiflazz/sync/logs', {
      query: { limit },
    })
  },

  autoSyncMissingDigiflazz() {
    return request('/api/digiflazz/sync/auto-missing', {
      method: 'POST',
    })
  },

  createPpobTransaction({ userId = DEFAULT_USER_ID, serviceId, customerRef, amountIdr, productType = 'general', productCode = null }) {
    return request('/api/ppob/transactions', {
      method: 'POST',
      body: { userId, serviceId, customerRef, amountIdr, productType, productCode },
    })
  },

  previewPpobPricing({ userId = null, serviceId, amountIdr, amountPi = 0, productType = 'general', productCode = null }) {
    return request('/api/ppob/pricing-preview', {
      method: 'POST',
      body: { userId, serviceId, amountIdr, amountPi, productType, productCode },
    })
  },

  listPpobTransactions(userId = DEFAULT_USER_ID) {
    return request('/api/ppob/transactions', { query: { userId } })
  },
}
