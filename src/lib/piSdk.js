export const PI_SDK_SESSION_KEY = 'pi_store_pi_sdk_session'

function parseStored(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function getPiSdkSession() {
  if (typeof window === 'undefined') return null
  return parseStored(window.localStorage.getItem(PI_SDK_SESSION_KEY))
}

export function savePiSdkSession(session) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PI_SDK_SESSION_KEY, JSON.stringify(session || {}))
}

export function clearPiSdkSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PI_SDK_SESSION_KEY)
}

export async function authenticateWithPiSdk() {
  if (typeof window === 'undefined' || !window.Pi?.authenticate) {
    throw new Error('Pi SDK belum tersedia. Buka lewat Pi Browser.')
  }

  const auth = await window.Pi.authenticate(['username', 'payments', 'wallet_address'], () => {})
  const uid = String(auth?.user?.uid || '').trim()
  if (!uid) {
    throw new Error('Autentikasi Pi SDK gagal: uid tidak ditemukan.')
  }

  return {
    uid,
    username: String(auth?.user?.username || '').trim() || null,
    accessToken: String(auth?.accessToken || '').trim() || null,
    walletAddress: String(auth?.user?.wallet_address || auth?.wallet_address || '').trim() || null,
    piBalance: Number(auth?.balance || auth?.pi_balance || auth?.piBalance || 0) || 0,
    authenticatedAt: Date.now(),
  }
}

export async function tryAuthenticateWithPiSdk() {
  try {
    return await authenticateWithPiSdk()
  } catch {
    return null
  }
}
