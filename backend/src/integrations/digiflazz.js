import crypto from 'node:crypto'

const DIGIFLAZZ_PRICE_LIST_URL = 'https://api.digiflazz.com/v1/price-list'

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex')
}

function normalizeCmd(cmd) {
  const v = String(cmd || '').toLowerCase()
  if (v === 'prepaid' || v === 'prabayar') return 'prepaid'
  if (v === 'pascabayar' || v === 'pasca' || v === 'postpaid') return 'pasca'
  return null
}

export async function fetchDigiflazzPriceList({ cmd, username, apiKey }) {
  const normalizedCmd = normalizeCmd(cmd)
  if (!normalizedCmd) {
    throw new Error(`Invalid cmd: ${cmd}`)
  }
  if (!username || !apiKey) {
    throw new Error('DIGIFLAZZ username/apiKey is required')
  }

  const sign = md5(`${username}${apiKey}pricelist`)
  const response = await fetch(DIGIFLAZZ_PRICE_LIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      cmd: normalizedCmd,
      username,
      sign,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Digiflazz HTTP ${response.status}: ${text}`)
  }

  const json = await response.json()
  if (!json) {
    throw new Error('Invalid Digiflazz response format')
  }

  if (!Array.isArray(json.data)) {
    const rc = json?.data?.rc || json?.rc
    const message = json?.data?.message || json?.message || 'Unknown Digiflazz error'
    throw new Error(`Digiflazz error${rc ? ` (rc ${rc})` : ''}: ${message}`)
  }

  // Guard against unexpected payload mix-up from upstream.
  // `prepaid` should contain `price`, while `pascabayar` should contain `admin/commission`.
  const first = json.data[0] || null
  if (first) {
    const hasPrepaidShape = Object.prototype.hasOwnProperty.call(first, 'price')
    const hasPostpaidShape =
      Object.prototype.hasOwnProperty.call(first, 'admin') ||
      Object.prototype.hasOwnProperty.call(first, 'commission')

    if (normalizedCmd === 'prepaid' && !hasPrepaidShape) {
      throw new Error('Digiflazz prepaid payload shape mismatch')
    }
    if (normalizedCmd === 'pasca' && !hasPostpaidShape) {
      throw new Error('Digiflazz pascabayar payload shape mismatch')
    }
  }

  return {
    cmd: normalizedCmd,
    data: json.data,
    raw: json,
  }
}

export async function upsertPrepaidProducts(mysql, items) {
  let affected = 0
  for (const item of items) {
    const [result] = await mysql.query(
      `INSERT INTO digiflazz_prepaid_products
       (buyer_sku_code, product_name, category, brand, type, seller_name, price_base_idr, price_base_pi,
        buyer_product_status, seller_product_status, unlimited_stock, stock, multi, start_cut_off, end_cut_off, desc_text, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         product_name = VALUES(product_name),
         category = VALUES(category),
         brand = VALUES(brand),
         type = VALUES(type),
         seller_name = VALUES(seller_name),
         price_base_idr = VALUES(price_base_idr),
         buyer_product_status = VALUES(buyer_product_status),
         seller_product_status = VALUES(seller_product_status),
         unlimited_stock = VALUES(unlimited_stock),
         stock = VALUES(stock),
         multi = VALUES(multi),
         start_cut_off = VALUES(start_cut_off),
         end_cut_off = VALUES(end_cut_off),
         desc_text = VALUES(desc_text),
         last_synced_at = NOW()`,
      [
        item.buyer_sku_code,
        item.product_name,
        item.category || null,
        item.brand || null,
        item.type || null,
        item.seller_name || null,
        Number(item.price || 0),
        item.buyer_product_status ? 1 : 0,
        item.seller_product_status ? 1 : 0,
        item.unlimited_stock ? 1 : 0,
        Number(item.stock || 0),
        item.multi ? 1 : 0,
        item.start_cut_off || null,
        item.end_cut_off || null,
        item.desc || null,
      ],
    )
    affected += Number(result.affectedRows || 0)
  }
  return affected
}

export async function upsertPostpaidProducts(mysql, items) {
  let affected = 0
  for (const item of items) {
    const sku = item.buyer_sku_code || item.product_code
    const [result] = await mysql.query(
      `INSERT INTO digiflazz_postpaid_products
       (buyer_sku_code, product_code, product_name, category, brand, seller_name,
        admin_base_idr, commission_base_idr, admin_base_pi, commission_base_pi,
        buyer_product_status, seller_product_status, desc_text, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         product_code = VALUES(product_code),
         product_name = VALUES(product_name),
         category = VALUES(category),
         brand = VALUES(brand),
         seller_name = VALUES(seller_name),
         admin_base_idr = VALUES(admin_base_idr),
         commission_base_idr = VALUES(commission_base_idr),
         buyer_product_status = VALUES(buyer_product_status),
         seller_product_status = VALUES(seller_product_status),
         desc_text = VALUES(desc_text),
         last_synced_at = NOW()`,
      [
        sku,
        sku,
        item.product_name,
        item.category || null,
        item.brand || null,
        item.seller_name || null,
        Number(item.admin || 0),
        Number(item.commission || 0),
        item.buyer_product_status ? 1 : 0,
        item.seller_product_status ? 1 : 0,
        item.desc || null,
      ],
    )
    affected += Number(result.affectedRows || 0)
  }
  return affected
}
