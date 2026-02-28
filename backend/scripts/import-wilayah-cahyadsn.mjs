import 'dotenv/config'
import Fastify from 'fastify'
import mysql from '@fastify/mysql'

const SOURCE_SQL_URL =
  'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql'

function parseWilayahTuples(sqlText) {
  const rows = []
  const tupleRegex = /\('((?:[^']|'')*)','((?:[^']|'')*)'\)/g
  let match
  while ((match = tupleRegex.exec(sqlText)) !== null) {
    const code = match[1].replace(/''/g, "'").trim()
    const name = match[2].replace(/''/g, "'").trim()
    if (!code || !name) continue
    rows.push({ code, name })
  }
  return rows
}

function normalizeCode(code) {
  return code.replace(/\./g, '')
}

function splitByLevel(rows) {
  const provinces = []
  const regencies = []
  const districts = []
  const villages = []

  for (const row of rows) {
    const level = row.code.split('.').length
    const normalized = normalizeCode(row.code)

    if (level === 1) {
      provinces.push({
        id: normalized,
        name: row.name,
      })
      continue
    }

    if (level === 2) {
      regencies.push({
        id: normalized,
        provinceId: normalized.slice(0, 2),
        name: row.name,
      })
      continue
    }

    if (level === 3) {
      districts.push({
        id: normalized,
        regencyId: normalized.slice(0, 4),
        name: row.name,
      })
      continue
    }

    if (level === 4) {
      villages.push({
        id: normalized,
        districtId: normalized.slice(0, 6),
        name: row.name,
        postalCode: null,
      })
    }
  }

  return { provinces, regencies, districts, villages }
}

async function upsertBatch(conn, table, columns, rows, batchSize = 1000) {
  if (!rows.length) return 0
  const placeholdersPerRow = `(${columns.map(() => '?').join(',')})`
  const updateColumns = columns.filter((col) => col !== 'id' && col !== 'user_id')
  const updateClause = updateColumns.map((col) => `${col} = VALUES(${col})`).join(', ')
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const values = chunk.flatMap((row) => columns.map((col) => row[col] ?? null))
    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${chunk.map(() => placeholdersPerRow).join(', ')}
      ON DUPLICATE KEY UPDATE ${updateClause}
    `
    // eslint-disable-next-line no-await-in-loop
    await conn.query(sql, values)
    inserted += chunk.length
  }

  return inserted
}

async function main() {
  const app = Fastify({ logger: false })
  await app.register(mysql, {
    promise: true,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pi_marketplace',
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  })

  try {
    const response = await fetch(SOURCE_SQL_URL)
    if (!response.ok) {
      throw new Error(`Failed to download source SQL (${response.status})`)
    }

    const sqlText = await response.text()
    const tuples = parseWilayahTuples(sqlText)
    if (!tuples.length) {
      throw new Error('No wilayah tuples found in source SQL')
    }

    const { provinces, regencies, districts, villages } = splitByLevel(tuples)
    const conn = await app.mysql.getConnection()

    try {
      await conn.beginTransaction()

      await upsertBatch(conn, 'indonesia_provinces', ['id', 'name'], provinces)
      await upsertBatch(conn, 'indonesia_regencies', ['id', 'province_id', 'name'], regencies.map((row) => ({
        id: row.id,
        province_id: row.provinceId,
        name: row.name,
      })))
      await upsertBatch(conn, 'indonesia_districts', ['id', 'regency_id', 'name'], districts.map((row) => ({
        id: row.id,
        regency_id: row.regencyId,
        name: row.name,
      })))
      await upsertBatch(conn, 'indonesia_villages', ['id', 'district_id', 'name', 'postal_code'], villages.map((row) => ({
        id: row.id,
        district_id: row.districtId,
        name: row.name,
        postal_code: row.postalCode,
      })))

      await conn.commit()

      const [provinceCountRows] = await conn.query('SELECT COUNT(*) AS total FROM indonesia_provinces')
      const [regencyCountRows] = await conn.query('SELECT COUNT(*) AS total FROM indonesia_regencies')
      const [districtCountRows] = await conn.query('SELECT COUNT(*) AS total FROM indonesia_districts')
      const [villageCountRows] = await conn.query('SELECT COUNT(*) AS total FROM indonesia_villages')

      console.log('Import wilayah selesai.')
      console.log(`Provinces : ${provinceCountRows[0].total}`)
      console.log(`Regencies : ${regencyCountRows[0].total}`)
      console.log(`Districts : ${districtCountRows[0].total}`)
      console.log(`Villages  : ${villageCountRows[0].total}`)
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } finally {
    await app.close()
  }
}

main().catch((error) => {
  console.error('Import wilayah gagal:', error.message)
  process.exit(1)
})
