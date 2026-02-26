/* global process */
const PI_API_BASE = 'https://api.minepi.com/v2'

function readBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.PI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Missing PI_API_KEY on server environment' })
    return
  }

  const { paymentId } = readBody(req)
  if (!paymentId) {
    res.status(400).json({ error: 'paymentId is required' })
    return
  }

  try {
    const response = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    const data = await response.json()
    if (!response.ok) {
      res.status(response.status).json({ error: data?.message || 'Pi approve failed', detail: data })
      return
    }

    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unexpected server error' })
  }
}

