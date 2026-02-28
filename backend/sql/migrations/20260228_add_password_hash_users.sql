USE pi_marketplace;

ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER phone;

UPDATE users
SET password_hash = SHA2('12345678', 256)
WHERE (password_hash IS NULL OR password_hash = '')
  AND phone IN ('081234567890', '082233445566');
