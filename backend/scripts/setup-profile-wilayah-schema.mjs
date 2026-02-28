import 'dotenv/config'
import Fastify from 'fastify'
import mysql from '@fastify/mysql'

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [table, column],
  )
  return rows.length > 0
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

  const conn = await app.mysql.getConnection()

  try {
    if (!(await columnExists(conn, 'users', 'profile_image_url'))) {
      await conn.query('ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(255) NULL AFTER password_hash')
      console.log('users.profile_image_url added')
    }

    if (!(await columnExists(conn, 'users', 'updated_at'))) {
      await conn.query(
        'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
      )
      console.log('users.updated_at added')
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS indonesia_provinces (
        id VARCHAR(2) PRIMARY KEY,
        name VARCHAR(120) NOT NULL
      )
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS indonesia_regencies (
        id VARCHAR(4) PRIMARY KEY,
        province_id VARCHAR(2) NOT NULL,
        name VARCHAR(120) NOT NULL,
        CONSTRAINT fk_regency_province FOREIGN KEY (province_id) REFERENCES indonesia_provinces(id)
      )
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS indonesia_districts (
        id VARCHAR(7) PRIMARY KEY,
        regency_id VARCHAR(4) NOT NULL,
        name VARCHAR(120) NOT NULL,
        CONSTRAINT fk_district_regency FOREIGN KEY (regency_id) REFERENCES indonesia_regencies(id)
      )
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS indonesia_villages (
        id VARCHAR(10) PRIMARY KEY,
        district_id VARCHAR(7) NOT NULL,
        name VARCHAR(120) NOT NULL,
        postal_code VARCHAR(10) NULL,
        CONSTRAINT fk_village_district FOREIGN KEY (district_id) REFERENCES indonesia_districts(id)
      )
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        user_id INT PRIMARY KEY,
        address_line TEXT NULL,
        province_id VARCHAR(2) NULL,
        regency_id VARCHAR(4) NULL,
        district_id VARCHAR(7) NULL,
        village_id VARCHAR(10) NULL,
        postal_code VARCHAR(10) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_address_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_address_province FOREIGN KEY (province_id) REFERENCES indonesia_provinces(id),
        CONSTRAINT fk_user_address_regency FOREIGN KEY (regency_id) REFERENCES indonesia_regencies(id),
        CONSTRAINT fk_user_address_district FOREIGN KEY (district_id) REFERENCES indonesia_districts(id),
        CONSTRAINT fk_user_address_village FOREIGN KEY (village_id) REFERENCES indonesia_villages(id)
      )
    `)

    console.log('Schema profile + wilayah ready.')
  } finally {
    conn.release()
    await app.close()
  }
}

main().catch((error) => {
  console.error('Setup schema gagal:', error.message)
  process.exit(1)
})
