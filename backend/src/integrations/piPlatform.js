const PI_API_BASE_URL = 'https://api.minepi.com/v2'

function getPiApiKey(piContext = null) {
  const key = String(piContext?.apiKey || process.env.PI_PLATFORM_API_KEY || '').trim()
  if (!key) {
    throw new Error('PI_PLATFORM_API_KEY must be set in .env')
  }
  return key
}

async function requestPiApi(path, { method = 'GET', body, piContext } = {}) {
  const apiKey = getPiApiKey(piContext)
  const res = await fetch(`${PI_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error || data?.message || `Pi API request failed (${res.status})`
    throw new Error(message)
  }

  return data
}

export function getPiPayment(paymentId, piContext = null) {
  return requestPiApi(`/payments/${paymentId}`, { piContext })
}

export function approvePiPayment(paymentId, piContext = null) {
  return requestPiApi(`/payments/${paymentId}/approve`, { method: 'POST', body: {}, piContext })
}

export function completePiPayment(paymentId, txid, piContext = null) {
  return requestPiApi(`/payments/${paymentId}/complete`, {
    method: 'POST',
    body: txid ? { txid } : {},
    piContext,
  })
}
