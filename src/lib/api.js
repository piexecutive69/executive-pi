const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100'
const API_KEY = import.meta.env.VITE_API_KEY || 'pi-store-local-dev-key'
const DEFAULT_USER_ID = Number(import.meta.env.VITE_DEFAULT_USER_ID || 1)

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
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.message || `Request failed (${response.status})`
    throw new Error(message)
  }
  return data
}

export const apiDefaultUserId = DEFAULT_USER_ID

export const api = {
  getUser(userId = DEFAULT_USER_ID) {
    return request(`/api/users/${userId}`)
  },

  loginByPhone({ phone, password }) {
    return request('/api/users/login', {
      method: 'POST',
      body: { phone, password },
    })
  },

  createUser({ name, email, phone, password }) {
    return request('/api/users', {
      method: 'POST',
      body: { name, email, phone, password },
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
