USE pi_marketplace;

INSERT INTO users (name, email, phone, password_hash, idr_balance, pi_balance)
VALUES
  ('Don Normane', 'don@pi-executive.com', '081234567890', SHA2('12345678', 256), 500000, 120.5000),
  ('Nadia Putri', 'nadia@pi-executive.com', '082233445566', SHA2('12345678', 256), 150000, 56.7000)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  idr_balance = VALUES(idr_balance),
  pi_balance = VALUES(pi_balance);

INSERT INTO product_categories (name, slug)
VALUES
  ('Bag', 'bag'),
  ('Cosmetics', 'cosmetics'),
  ('Shoe', 'shoe')
ON DUPLICATE KEY UPDATE
  name = VALUES(name);

INSERT INTO products (category_id, slug, name, description, price_idr, price_pi, stock, rating, image_url, is_active)
SELECT c.id, 'leather-bag', 'Leather Bag',
       'Tas kulit premium untuk kebutuhan harian dengan kompartemen utama luas dan material tahan lama.',
       320000, 3.2, 22, 4.8, '/assets/img/products/product1.png', 1
FROM product_categories c WHERE c.slug = 'bag'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price_idr = VALUES(price_idr),
  price_pi = VALUES(price_pi),
  stock = VALUES(stock),
  rating = VALUES(rating),
  image_url = VALUES(image_url),
  is_active = VALUES(is_active);

INSERT INTO products (category_id, slug, name, description, price_idr, price_pi, stock, rating, image_url, is_active)
SELECT c.id, 'lipstick', 'Lipstick',
       'Lipstick matte dengan warna tahan lama, ringan di bibir, dan cocok untuk aktivitas sehari-hari.',
       30000, 0.3, 43, 4.6, '/assets/img/products/product2.png', 1
FROM product_categories c WHERE c.slug = 'cosmetics'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price_idr = VALUES(price_idr),
  price_pi = VALUES(price_pi),
  stock = VALUES(stock),
  rating = VALUES(rating),
  image_url = VALUES(image_url),
  is_active = VALUES(is_active);

INSERT INTO products (category_id, slug, name, description, price_idr, price_pi, stock, rating, image_url, is_active)
SELECT c.id, 'sports-shoe', 'Sports Shoe',
       'Sepatu olahraga ringan dengan grip kuat dan sirkulasi udara yang nyaman untuk penggunaan aktif.',
       20000, 0.2, 31, 4.7, '/assets/img/products/product3.png', 1
FROM product_categories c WHERE c.slug = 'shoe'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price_idr = VALUES(price_idr),
  price_pi = VALUES(price_pi),
  stock = VALUES(stock),
  rating = VALUES(rating),
  image_url = VALUES(image_url),
  is_active = VALUES(is_active);

INSERT INTO products (category_id, slug, name, description, price_idr, price_pi, stock, rating, image_url, is_active)
SELECT c.id, 'premium-shoe', 'Premium Shoe',
       'Sepatu premium dengan desain eksklusif, bantalan empuk, dan detail finishing berkualitas tinggi.',
       120000, 1.2, 14, 4.9, '/assets/img/products/product4.png', 1
FROM product_categories c WHERE c.slug = 'shoe'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  price_idr = VALUES(price_idr),
  price_pi = VALUES(price_pi),
  stock = VALUES(stock),
  rating = VALUES(rating),
  image_url = VALUES(image_url),
  is_active = VALUES(is_active);

INSERT INTO ppob_services (code, name, admin_fee_idr, admin_fee_pi, is_active)
VALUES
  ('PLN', 'Listrik PLN', 2500, 0.02, 1),
  ('BPJS', 'BPJS Kesehatan', 2000, 0.02, 1),
  ('PDAM', 'PDAM', 2500, 0.02, 1),
  ('NET', 'Internet', 2000, 0.02, 1),
  ('EWALLET', 'E-Wallet Topup', 1500, 0.01, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  admin_fee_idr = VALUES(admin_fee_idr),
  admin_fee_pi = VALUES(admin_fee_pi),
  is_active = VALUES(is_active);

INSERT INTO payment_gateways (code, name, is_active)
VALUES
  ('pi_sdk', 'Pi SDK', 1),
  ('duitku', 'Duitku Payment Gateway', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active);

INSERT INTO membership_levels (code, display_name, sort_order, upgrade_fee_idr, upgrade_fee_pi, is_default, is_active)
VALUES
  ('member', 'Member', 1, 0, 0, 1, 1),
  ('reseller', 'Reseller', 2, 0, 0, 0, 1),
  ('agen', 'Agen', 3, 0, 0, 0, 1),
  ('distributor', 'Distributor', 4, 0, 0, 0, 1)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  sort_order = VALUES(sort_order),
  is_default = VALUES(is_default),
  is_active = VALUES(is_active);

INSERT INTO user_memberships (user_id, level_id, status)
SELECT u.id, ml.id, 'active'
FROM users u
JOIN membership_levels ml ON ml.code = 'member'
LEFT JOIN user_memberships um ON um.user_id = u.id
WHERE um.user_id IS NULL;

INSERT INTO product_markups (level_id, product_type, product_code, markup_mode, markup_idr, min_markup_idr, is_active)
SELECT ml.id, 'prepaid', CONCAT('GLOBAL_PREPAID_', ml.code), 'fixed',
       CASE ml.code WHEN 'member' THEN 2000 WHEN 'reseller' THEN 1500 WHEN 'agen' THEN 1000 WHEN 'distributor' THEN 500 ELSE 2000 END,
       0, 1
FROM membership_levels ml
ON DUPLICATE KEY UPDATE
  markup_mode = VALUES(markup_mode),
  markup_idr = VALUES(markup_idr),
  min_markup_idr = VALUES(min_markup_idr),
  is_active = VALUES(is_active);

INSERT INTO product_markups (level_id, product_type, product_code, markup_mode, markup_idr, min_markup_idr, is_active)
SELECT ml.id, 'postpaid', CONCAT('GLOBAL_POSTPAID_', ml.code), 'fixed',
       CASE ml.code WHEN 'member' THEN 2000 WHEN 'reseller' THEN 1500 WHEN 'agen' THEN 1000 WHEN 'distributor' THEN 500 ELSE 2000 END,
       0, 1
FROM membership_levels ml
ON DUPLICATE KEY UPDATE
  markup_mode = VALUES(markup_mode),
  markup_idr = VALUES(markup_idr),
  min_markup_idr = VALUES(min_markup_idr),
  is_active = VALUES(is_active);
