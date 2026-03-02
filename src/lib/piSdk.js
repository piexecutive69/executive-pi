export const PI_SDK_SESSION_KEY = 'pi_store_pi_sdk_session'
export const PI_REQUIRED_SCOPES = ['username', 'payments', 'wallet_address']
const PI_AUTH_TIMEOUT_MS = 3500

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

  const auth = await Promise.race([
    window.Pi.authenticate(PI_REQUIRED_SCOPES, () => {}),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Pi SDK timeout. Buka aplikasi dari Pi App URL lalu coba lagi.')), PI_AUTH_TIMEOUT_MS)
    }),
  ])
  const uid = String(auth?.user?.uid || auth?.uid || '').trim()
  if (!uid) {
    throw new Error('Autentikasi Pi SDK gagal: uid tidak ditemukan.')
  }

  const walletAddress = String(
    auth?.user?.wallet_address ||
      auth?.user?.walletAddress ||
      auth?.wallet_address ||
      auth?.walletAddress ||
      auth?.wallet?.address ||
      '',
  ).trim() || null

  // Pi SDK does not expose private key/secret; store only safe identifier if available.
  const walletSecretId = String(
    auth?.wallet_secret_id ||
      auth?.walletSecretId ||
      auth?.wallet?.id ||
      auth?.wallet_id ||
      '',
  ).trim() || null

  const piBalance = Number(
    auth?.balance ??
      auth?.pi_balance ??
      auth?.piBalance ??
      auth?.user?.balance ??
      auth?.user?.pi_balance ??
      auth?.user?.piBalance ??
      0,
  ) || 0

  const scopesRaw =
    auth?.scopes ||
    auth?.user?.scopes ||
    auth?.credentials?.scopes ||
    auth?.user?.credentials?.scopes ||
    []
  const scopes = Array.isArray(scopesRaw)
    ? scopesRaw.map((scope) => String(scope || '').trim()).filter(Boolean)
    : []

  return {
    uid,
    username: String(auth?.user?.username || '').trim() || null,
    accessToken: String(auth?.accessToken || '').trim() || null,
    walletAddress,
    walletSecretId,
    piBalance,
    scopes,
    authenticatedAt: Date.now(),
  }
}

export function hasRequiredPiScopes(session, requiredScopes = PI_REQUIRED_SCOPES) {
  const currentScopes = Array.isArray(session?.scopes)
    ? session.scopes.map((scope) => String(scope || '').trim().toLowerCase()).filter(Boolean)
    : []
  const scopeSet = new Set(currentScopes)
  return requiredScopes.every((scope) => scopeSet.has(String(scope || '').trim().toLowerCase()))
}

export async function tryAuthenticateWithPiSdk() {
  try {
    return await authenticateWithPiSdk()
  } catch {
    return null
  }
}

export function createPiSdkPayment({
  amount,
  memo,
  metadata = {},
  onReadyForServerApproval,
  onReadyForServerCompletion,
  onIncompletePaymentFound,
  onCancel,
}) {
  if (typeof window === 'undefined' || !window.Pi?.createPayment) {
    throw new Error('Pi SDK payment belum tersedia. Buka lewat Pi Browser.')
  }

  const normalizedAmount = Number(amount || 0)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Nominal Pi payment tidak valid.')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finishResolve = (payload) => {
      if (settled) return
      settled = true
      resolve(payload)
    }
    const finishReject = (error) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error?.message || error || 'Pi payment failed')))
    }

    window.Pi.createPayment(
      {
        amount: normalizedAmount,
        memo: String(memo || 'PI Store payment'),
        metadata: metadata || {},
      },
      {
        onReadyForServerApproval: async (paymentId) => {
          try {
            await onReadyForServerApproval?.(paymentId)
          } catch (error) {
            finishReject(error)
            throw error
          }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          try {
            await onReadyForServerCompletion?.(paymentId, txid)
            finishResolve({ status: 'completed', paymentId, txid: txid || null })
          } catch (error) {
            finishReject(error)
            throw error
          }
        },
        onCancel: async (paymentId) => {
          try {
            await onCancel?.(paymentId)
          } finally {
            finishResolve({ status: 'cancelled', paymentId })
          }
        },
        onIncompletePaymentFound: async (payment) => {
          try {
            await onIncompletePaymentFound?.(payment)
          } catch (error) {
            finishReject(error)
            throw error
          }
        },
        onError: (error) => {
          finishReject(error)
        },
      },
    )
  })
}
