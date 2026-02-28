CREATE DATABASE IF NOT EXISTS pi_marketplace;
USE pi_marketplace;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  idr_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  pi_balance DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS product_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  description TEXT,
  price_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  image_url VARCHAR(255),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE KEY uq_cart_user_product (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('pending','waiting_payment','paid','cancelled','completed') NOT NULL DEFAULT 'pending',
  subtotal_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  shipping_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  payment_method VARCHAR(60) NOT NULL DEFAULT 'wallet_idr',
  shipping_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(190) NOT NULL,
  qty INT NOT NULL,
  unit_price_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_price_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  line_total_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS ppob_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  admin_fee_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  admin_fee_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ppob_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  membership_level_id TINYINT NULL,
  membership_code ENUM('member','reseller','agen','distributor') NULL,
  product_type ENUM('prepaid','postpaid','general') NOT NULL DEFAULT 'general',
  product_code VARCHAR(120) NULL,
  customer_ref VARCHAR(120) NOT NULL,
  base_amount_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  admin_fee_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  admin_fee_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ppob_tx_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ppob_tx_service FOREIGN KEY (service_id) REFERENCES ppob_services(id)
);

-- =========================================================
-- Marketplace extension: Digiflazz + Affiliate + Membership
-- =========================================================

CREATE TABLE IF NOT EXISTS membership_levels (
  id TINYINT AUTO_INCREMENT PRIMARY KEY,
  code ENUM('member','reseller','agen','distributor') NOT NULL UNIQUE,
  display_name VARCHAR(50) NOT NULL,
  sort_order TINYINT NOT NULL UNIQUE,
  upgrade_fee_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  upgrade_fee_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_memberships (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  level_id TINYINT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  status ENUM('active','expired','suspended') NOT NULL DEFAULT 'active',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_membership_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_membership_level FOREIGN KEY (level_id) REFERENCES membership_levels(id)
);

CREATE TABLE IF NOT EXISTS membership_upgrade_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  from_level_id TINYINT,
  to_level_id TINYINT NOT NULL,
  fee_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  fee_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  payment_reference VARCHAR(120),
  upgraded_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_upgrade_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_upgrade_from_level FOREIGN KEY (from_level_id) REFERENCES membership_levels(id),
  CONSTRAINT fk_upgrade_to_level FOREIGN KEY (to_level_id) REFERENCES membership_levels(id)
);

CREATE TABLE IF NOT EXISTS affiliate_relations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  upline_user_id INT NOT NULL,
  depth TINYINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_aff_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_aff_upline FOREIGN KEY (upline_user_id) REFERENCES users(id),
  UNIQUE KEY uq_aff_user_depth (user_id, depth),
  CHECK (depth BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS affiliate_bonus_rules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  rule_type ENUM('transaction_bonus','upgrade_bonus') NOT NULL,
  for_level_id TINYINT NOT NULL,
  depth TINYINT NOT NULL,
  bonus_mode ENUM('percentage','fixed') NOT NULL,
  bonus_value DECIMAL(12,4) NOT NULL,
  bonus_currency ENUM('idr','pi') NOT NULL DEFAULT 'idr',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bonus_rule_level FOREIGN KEY (for_level_id) REFERENCES membership_levels(id),
  CHECK (depth BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS affiliate_bonus_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  beneficiary_user_id INT NOT NULL,
  source_user_id INT NOT NULL,
  rule_id BIGINT NOT NULL,
  source_type ENUM('prepaid','postpaid','membership_upgrade') NOT NULL,
  source_reference_id BIGINT,
  amount_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','approved','paid','cancelled') NOT NULL DEFAULT 'pending',
  notes VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  CONSTRAINT fk_bonus_beneficiary FOREIGN KEY (beneficiary_user_id) REFERENCES users(id),
  CONSTRAINT fk_bonus_source_user FOREIGN KEY (source_user_id) REFERENCES users(id),
  CONSTRAINT fk_bonus_rule FOREIGN KEY (rule_id) REFERENCES affiliate_bonus_rules(id)
);

CREATE TABLE IF NOT EXISTS digiflazz_brands (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  type ENUM('prepaid','postpaid') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digiflazz_prepaid_products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  buyer_sku_code VARCHAR(120) NOT NULL UNIQUE,
  product_name VARCHAR(190) NOT NULL,
  category VARCHAR(120),
  brand VARCHAR(120),
  type VARCHAR(120),
  seller_name VARCHAR(120),
  price_base_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_base_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  buyer_product_status TINYINT(1) NOT NULL DEFAULT 1,
  seller_product_status TINYINT(1) NOT NULL DEFAULT 1,
  unlimited_stock TINYINT(1) NOT NULL DEFAULT 1,
  stock INT NOT NULL DEFAULT 0,
  multi VARCHAR(20),
  start_cut_off VARCHAR(20),
  end_cut_off VARCHAR(20),
  desc_text TEXT,
  last_synced_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digiflazz_postpaid_products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  buyer_sku_code VARCHAR(120) NOT NULL UNIQUE,
  product_code VARCHAR(120),
  product_name VARCHAR(190) NOT NULL,
  category VARCHAR(120),
  brand VARCHAR(120),
  seller_name VARCHAR(120),
  admin_base_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_base_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  admin_base_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  commission_base_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  buyer_product_status TINYINT(1) NOT NULL DEFAULT 1,
  seller_product_status TINYINT(1) NOT NULL DEFAULT 1,
  desc_text TEXT,
  last_synced_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_markups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  level_id TINYINT NOT NULL,
  product_type ENUM('prepaid','postpaid') NOT NULL,
  product_reference_id BIGINT NULL,
  product_code VARCHAR(120) NULL,
  markup_mode ENUM('fixed','percentage') NOT NULL DEFAULT 'fixed',
  markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  markup_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  min_markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_markups_level FOREIGN KEY (level_id) REFERENCES membership_levels(id),
  UNIQUE KEY uq_markups_scope (level_id, product_type, product_code)
);

CREATE TABLE IF NOT EXISTS prepaid_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  membership_level_id TINYINT NOT NULL,
  buyer_sku_code VARCHAR(120) NOT NULL,
  customer_no VARCHAR(80) NOT NULL,
  ref_id VARCHAR(120),
  server_ref VARCHAR(120),
  base_price_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  final_price_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  base_price_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  markup_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  final_price_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  digiflazz_status VARCHAR(60),
  serial_number TEXT,
  message TEXT,
  metadata_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prepaid_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_prepaid_level FOREIGN KEY (membership_level_id) REFERENCES membership_levels(id),
  INDEX idx_prepaid_user_created (user_id, created_at),
  INDEX idx_prepaid_status (status)
);

CREATE TABLE IF NOT EXISTS postpaid_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  membership_level_id TINYINT NOT NULL,
  product_code VARCHAR(120) NOT NULL,
  customer_no VARCHAR(80) NOT NULL,
  customer_name VARCHAR(190),
  period VARCHAR(30),
  ref_id VARCHAR(120),
  server_ref VARCHAR(120),
  amount_bill_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  admin_base_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_bill_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  admin_base_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  markup_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','inquiry','success','failed','refunded') NOT NULL DEFAULT 'pending',
  digiflazz_status VARCHAR(60),
  message TEXT,
  metadata_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_postpaid_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_postpaid_level FOREIGN KEY (membership_level_id) REFERENCES membership_levels(id),
  INDEX idx_postpaid_user_created (user_id, created_at),
  INDEX idx_postpaid_status (status)
);

CREATE TABLE IF NOT EXISTS payment_gateways (
  id TINYINT AUTO_INCREMENT PRIMARY KEY,
  code ENUM('pi_sdk','duitku') NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_gateway_configs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  gateway_id TINYINT NOT NULL,
  environment ENUM('sandbox','production') NOT NULL DEFAULT 'sandbox',
  config_key VARCHAR(120) NOT NULL,
  config_value TEXT NOT NULL,
  is_encrypted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gateway_configs_gateway FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id),
  UNIQUE KEY uq_gateway_env_key (gateway_id, environment, config_key)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  gateway_id TINYINT NOT NULL,
  source_type ENUM('order','prepaid','postpaid','membership_upgrade','wallet_topup') NOT NULL,
  source_reference_id BIGINT NOT NULL,
  external_reference VARCHAR(190),
  amount_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_pi DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  request_payload JSON,
  response_payload JSON,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_tx_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_payment_tx_gateway FOREIGN KEY (gateway_id) REFERENCES payment_gateways(id),
  INDEX idx_payment_source (source_type, source_reference_id),
  INDEX idx_payment_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS wallet_topups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount_idr DECIMAL(12,2) NOT NULL,
  admin_fee_idr DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_idr DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
  duitku_reference VARCHAR(190),
  payment_url TEXT,
  payment_transaction_id BIGINT,
  request_payload JSON,
  callback_payload JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  CONSTRAINT fk_wallet_topup_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_wallet_topup_payment_tx FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id),
  INDEX idx_wallet_topup_user_created (user_id, created_at),
  INDEX idx_wallet_topup_status (status)
);

CREATE TABLE IF NOT EXISTS digiflazz_webhook_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(80),
  signature VARCHAR(255),
  payload JSON NOT NULL,
  processed TINYINT(1) NOT NULL DEFAULT 0,
  processing_notes VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS digiflazz_sync_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sync_type ENUM('prepaid_products','postpaid_products','price_update') NOT NULL,
  status ENUM('running','success','failed') NOT NULL DEFAULT 'running',
  request_payload JSON,
  response_payload JSON,
  total_records INT NOT NULL DEFAULT 0,
  notes VARCHAR(255),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL
);
