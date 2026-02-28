USE pi_marketplace;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(255) NULL AFTER password_hash,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

CREATE TABLE IF NOT EXISTS indonesia_provinces (
  id VARCHAR(2) PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS indonesia_regencies (
  id VARCHAR(4) PRIMARY KEY,
  province_id VARCHAR(2) NOT NULL,
  name VARCHAR(120) NOT NULL,
  CONSTRAINT fk_regency_province FOREIGN KEY (province_id) REFERENCES indonesia_provinces(id)
);

CREATE TABLE IF NOT EXISTS indonesia_districts (
  id VARCHAR(7) PRIMARY KEY,
  regency_id VARCHAR(4) NOT NULL,
  name VARCHAR(120) NOT NULL,
  CONSTRAINT fk_district_regency FOREIGN KEY (regency_id) REFERENCES indonesia_regencies(id)
);

CREATE TABLE IF NOT EXISTS indonesia_villages (
  id VARCHAR(10) PRIMARY KEY,
  district_id VARCHAR(7) NOT NULL,
  name VARCHAR(120) NOT NULL,
  postal_code VARCHAR(10) NULL,
  CONSTRAINT fk_village_district FOREIGN KEY (district_id) REFERENCES indonesia_districts(id)
);

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
);

