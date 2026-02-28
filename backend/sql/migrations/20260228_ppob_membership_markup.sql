USE pi_marketplace;

ALTER TABLE ppob_transactions ADD COLUMN membership_level_id TINYINT NULL AFTER service_id;
ALTER TABLE ppob_transactions ADD COLUMN membership_code ENUM('member','reseller','agen','distributor') NULL AFTER membership_level_id;
ALTER TABLE ppob_transactions ADD COLUMN product_type ENUM('prepaid','postpaid','general') NOT NULL DEFAULT 'general' AFTER membership_code;
ALTER TABLE ppob_transactions ADD COLUMN product_code VARCHAR(120) NULL AFTER product_type;
ALTER TABLE ppob_transactions ADD COLUMN base_amount_idr DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER customer_ref;
ALTER TABLE ppob_transactions ADD COLUMN markup_idr DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER base_amount_idr;

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
