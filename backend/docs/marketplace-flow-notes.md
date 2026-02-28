# Catatan Requirement Marketplace (Digiflazz + Affiliate)

## Scope yang sudah direkam di schema
- Produk `prabayar` dan `pascabayar` dari Digiflazz.
- Markup harga per level member:
  - `member` (free)
  - `reseller`
  - `agen`
  - `distributor`
- Struktur afiliasi kedalaman 3 level (`depth 1..3`).
- Bonus:
  - bonus transaksi
  - bonus upgrade level
- Persiapan integrasi pembayaran:
  - `pi_sdk`
  - `duitku`

## Tabel utama baru
- `membership_levels`
- `user_memberships`
- `membership_upgrade_history`
- `affiliate_relations`
- `affiliate_bonus_rules`
- `affiliate_bonus_ledger`
- `digiflazz_prepaid_products`
- `digiflazz_postpaid_products`
- `product_markups`
- `prepaid_transactions`
- `postpaid_transactions`
- `payment_gateways`
- `payment_gateway_configs`
- `payment_transactions`
- `digiflazz_webhook_logs`
- `digiflazz_sync_logs`

## Catatan untuk pembahasan berikutnya
Saat masuk ke response Digiflazz, kita tinggal mapping payload ke:
- sinkron katalog -> `digiflazz_prepaid_products` / `digiflazz_postpaid_products`
- transaksi -> `prepaid_transactions` / `postpaid_transactions`
- callback/webhook -> `digiflazz_webhook_logs`
- perhitungan final harga -> `product_markups` + `membership_levels`
- bonus referral -> `affiliate_bonus_rules` + `affiliate_bonus_ledger`
