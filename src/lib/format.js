export function formatIDR(amount) {
  return `IDR ${Number(amount || 0).toLocaleString('id-ID')}`
}

export function formatPi(amount) {
  return `${Number(amount || 0).toFixed(2)} Pi`
}
