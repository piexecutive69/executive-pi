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
  const headers = {
    'x-api-key': API_KEY,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`)
  }

  return data
}

export const apiBaseUrl = API_BASE_URL

export const api = {
  getSummary() {
    return request('/api/admin/summary')
  },

  listProducts({ page = 1, limit = 10, search = '', status = 'all' } = {}) {
    return request('/api/admin/products', {
      query: { page, limit, search, status },
    })
  },

  listProductCategories() {
    return request('/api/admin/product-categories')
  },

  createProduct(payload) {
    return request('/api/admin/products', {
      method: 'POST',
      body: payload,
    })
  },

  updateProduct(id, payload) {
    return request(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  async uploadProductImage({ file, previousImageUrl = '' }) {
    const formData = new FormData()
    formData.append('image', file)
    if (previousImageUrl) {
      formData.append('previousImageUrl', previousImageUrl)
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/products/upload-image`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
      },
      body: formData,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status})`)
    }
    return data
  },

  listOrders({ page = 1, limit = 10, search = '', status = '' } = {}) {
    return request('/api/admin/orders', {
      query: { page, limit, search, status },
    })
  },

  getOrderDetail(orderId) {
    return request(`/api/admin/orders/${orderId}`)
  },

  updateOrderStatus(orderId, status) {
    return request(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    })
  },

  listPiWallets({ page = 1, limit = 10, search = '', status = 'all' } = {}) {
    return request('/api/admin/pi-wallets', {
      query: { page, limit, search, status },
    })
  },

  syncDigiflazz(cmd = 'all') {
    return request('/api/digiflazz/sync/price-list', {
      method: 'POST',
      body: { cmd, dryRun: false },
    })
  },

  autoSyncMissingDigiflazz() {
    return request('/api/digiflazz/sync/auto-missing', {
      method: 'POST',
    })
  },

  listDigiflazzLogs(limit = 20) {
    return request('/api/digiflazz/sync/logs', {
      query: { limit },
    })
  },
}
