import crypto from 'node:crypto'

function getDuitkuUrl(environment) {
  const env = String(environment || 'sandbox').toLowerCase()
  if (env === 'production') {
    return 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry'
  }
  return 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry'
}

function makeSignature({ merchantCode, merchantOrderId, paymentAmount, apiKey }) {
  const source = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`
  return crypto.createHash('md5').update(source).digest('hex')
}

export async function createDuitkuInvoice({
  merchantCode,
  apiKey,
  environment = 'sandbox',
  merchantOrderId,
  paymentAmount,
  productDetails,
  customerName,
  email,
  phoneNumber,
  callbackUrl,
  returnUrl,
  expiryPeriod = 60,
}) {
  if (!merchantCode || !apiKey) {
    throw new Error('DUITKU_MERCHANT_CODE and DUITKU_API_KEY are required')
  }

  const amount = Number(paymentAmount || 0)
  if (amount <= 0) {
    throw new Error('paymentAmount must be greater than 0')
  }

  const payload = {
    merchantCode,
    paymentAmount: Math.round(amount),
    merchantOrderId,
    productDetails,
    customerVaName: customerName || 'PI Store User',
    email,
    phoneNumber,
    callbackUrl,
    returnUrl,
    expiryPeriod,
    signature: makeSignature({
      merchantCode,
      merchantOrderId,
      paymentAmount: Math.round(amount),
      apiKey,
    }),
  }

  const response = await fetch(getDuitkuUrl(environment), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.Message || data?.message || `Duitku API error (${response.status})`)
  }

  if (String(data?.statusCode || '') !== '00') {
    throw new Error(data?.statusMessage || data?.message || 'Duitku invoice rejected')
  }

  return {
    externalReference: merchantOrderId,
    paymentUrl: data?.paymentUrl || null,
    gatewayResponse: data,
  }
}
