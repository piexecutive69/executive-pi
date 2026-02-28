const KEY_PREFIX = 'pi_store_wishlist_user_'

function storageKey(userId) {
  return `${KEY_PREFIX}${Number(userId) || 0}`
}

function readList(userId) {
  if (!userId || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeList(userId, items) {
  if (!userId || typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), JSON.stringify(items))
}

export function listWishlist(userId) {
  return readList(userId)
}

export function isWishlisted(userId, productId) {
  const id = Number(productId)
  return readList(userId).some((item) => Number(item.id) === id)
}

export function toggleWishlist(userId, product) {
  if (!userId || !product?.id) return readList(userId)
  const current = readList(userId)
  const id = Number(product.id)
  const exists = current.some((item) => Number(item.id) === id)
  const next = exists
    ? current.filter((item) => Number(item.id) !== id)
    : [
        {
          id: Number(product.id),
          name: product.name || '',
          image_url: product.image_url || product.image || '',
          category_name: product.category_name || product.category || '',
          price_idr: product.price_idr ?? null,
          price_pi: product.price_pi ?? null,
        },
        ...current,
      ]
  writeList(userId, next)
  return next
}
