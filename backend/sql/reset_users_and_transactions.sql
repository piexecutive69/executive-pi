USE pi_store_live_20260301;

SET FOREIGN_KEY_CHECKS = 0;

-- Transactional/runtime data
DELETE FROM affiliate_bonus_ledger;
ALTER TABLE affiliate_bonus_ledger AUTO_INCREMENT = 1;
DELETE FROM membership_upgrade_history;
ALTER TABLE membership_upgrade_history AUTO_INCREMENT = 1;
DELETE FROM affiliate_relations;
ALTER TABLE affiliate_relations AUTO_INCREMENT = 1;
DELETE FROM prepaid_transactions;
ALTER TABLE prepaid_transactions AUTO_INCREMENT = 1;
DELETE FROM postpaid_transactions;
ALTER TABLE postpaid_transactions AUTO_INCREMENT = 1;
DELETE FROM ppob_transactions;
ALTER TABLE ppob_transactions AUTO_INCREMENT = 1;
DELETE FROM wallet_topups;
ALTER TABLE wallet_topups AUTO_INCREMENT = 1;
DELETE FROM payment_transactions;
ALTER TABLE payment_transactions AUTO_INCREMENT = 1;
DELETE FROM pi_payment_records;
ALTER TABLE pi_payment_records AUTO_INCREMENT = 1;
DELETE FROM api_idempotency_keys;
ALTER TABLE api_idempotency_keys AUTO_INCREMENT = 1;
DELETE FROM order_items;
ALTER TABLE order_items AUTO_INCREMENT = 1;
DELETE FROM orders;
ALTER TABLE orders AUTO_INCREMENT = 1;
DELETE FROM cart_items;
ALTER TABLE cart_items AUTO_INCREMENT = 1;
DELETE FROM digiflazz_webhook_logs;
ALTER TABLE digiflazz_webhook_logs AUTO_INCREMENT = 1;
DELETE FROM digiflazz_sync_logs;
ALTER TABLE digiflazz_sync_logs AUTO_INCREMENT = 1;

-- User scoped data
DELETE FROM user_addresses;
ALTER TABLE user_addresses AUTO_INCREMENT = 1;
DELETE FROM user_pi_wallets;
ALTER TABLE user_pi_wallets AUTO_INCREMENT = 1;
DELETE FROM user_memberships;
ALTER TABLE user_memberships AUTO_INCREMENT = 1;
DELETE FROM users;
ALTER TABLE users AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- NOTE:
-- System configuration is intentionally preserved:
-- system_configs, payment_gateways, payment_gateway_configs,
-- membership_levels, product_markups, affiliate_bonus_rules, products, product_categories.
