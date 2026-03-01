# Progress Notes - PI Store

Last update: 2026-02-28

## Backend status (Fastify + MySQL)

### Done
- IDR-first checkout flow implemented:
  - `POST /api/orders/checkout`
  - payment methods: `wallet_idr`, `duitku`
  - order totals in IDR, cart clear after checkout, stock deduction
- Duitku order callback implemented:
  - `POST /api/orders/duitku/callback`
  - paid => order `paid`
  - failed => order `cancelled` + stock restore
- Wallet topup via Duitku implemented:
  - `POST /api/wallet/topup/duitku`
  - `POST /api/wallet/topup/duitku/callback`
  - successful callback increments `users.idr_balance`
- Digiflazz sync endpoint implemented:
  - `POST /api/digiflazz/sync/price-list`
  - supports `prepaid`, `pascabayar`, `all`
- Database schema updated for:
  - `users.idr_balance`
  - `wallet_topups`
  - expanded `payment_transactions.source_type`
  - order status includes `waiting_payment`
- Swagger docs added:
  - UI: `/docs`
  - JSON: `/docs/json`
  - schema added for main routes (`health/users/products/cart/orders/wallet/ppob/digiflazz`)
- API key middleware added:
  - all `/api/*` require header `x-api-key`
  - exceptions:
    - `GET /api/health`
    - `POST /api/orders/duitku/callback`
    - `POST /api/wallet/topup/duitku/callback`
- Env templates updated:
  - `API_KEY`
  - Digiflazz credentials fields
  - Duitku config fields

## Important files
- `backend/src/server.js`
- `backend/src/routes/orders.js`
- `backend/src/routes/wallet.js`
- `backend/src/routes/digiflazz.js`
- `backend/src/routes/cart.js`
- `backend/src/routes/products.js`
- `backend/src/routes/users.js`
- `backend/src/routes/ppob.js`
- `backend/src/routes/health.js`
- `backend/src/integrations/duitku.js`
- `backend/sql/schema.sql`
- `backend/sql/seed.sql`
- `backend/.env.example`
- `backend/README.md`

## Pending / next
- Create DB locally if not yet:
  - `mysql -u root < backend/sql/schema.sql`
  - `mysql -u root pi_marketplace < backend/sql/seed.sql`
- Fill real Duitku credentials in `backend/.env`:
  - `DUITKU_MERCHANT_CODE`
  - `DUITKU_API_KEY`
- Add strict webhook signature verification for Duitku callbacks
- Add auth layer (JWT/session) + role-based access
- Add request/response examples in Swagger for each endpoint
- Add migration strategy (currently schema-first)
- Frontend integration:
  - attach `x-api-key` in all API calls
  - use `/docs` as API contract source

## Quick resume checklist for next chat
1. Start from `D:\web\pi-store\backend`.
2. Ensure DB exists and `.env` is filled.
3. Run `npm run dev`.
4. Open `http://localhost:3100/docs`.
5. Continue from "Pending / next" section above.

---

Last update: 2026-03-02 (post-deploy)

## Latest deployment + feature status

### Production server
- Server: `72.60.76.60`
- Domains:
  - `https://store.pi-executive.com`
  - `https://mall.pi-executive.com`
- Services:
  - `apache2` active
  - `pi-sdk-api.service` active (serving `/home/pi-store-api/src/server.js` on port `3011`)
- Apache proxy fixed to map `/api/*` -> backend and SPA fallback enabled.

### Database
- Active DB: `pi_store_live_20260301`
- Wilayah data imported:
  - provinces: 38
  - regencies: 514
  - districts: 7285
  - villages: 83762
- Digiflazz synced:
  - prepaid: 798
  - postpaid: 123

### UI/UX updates already live
- Bottom nav offset adjusted for Android/Pi Browser safe area.
- Product name font on home reduced.
- PPOB facets grid changed to 3 columns.
- Postpaid facet labels cleaned (`PASCABAYAR` suffix hidden in UI).
- `BPJS KETENAGAKERJAAN` filtered out from backend facets response.
- Header logo fixed and rewrite exceptions added (`/logo_pi.png`).

### Profile/Drawer parity
- Drawer now uses same profile menu source as Profile page.
- Drawer follows login state (guest vs logged-in):
  - guest: login/register CTA
  - logged-in: menu active + logout + balance blocks

### Pi SDK integration (new architecture)
- Register/Login remains form-based:
  - register: name + email + phone + password
  - login: phone + password
- Pi SDK detected in frontend and sent as optional `piAuth` payload to backend.
- Backend now handles Pi linking and wallet sync internally.
- New table created automatically by backend route init:
  - `user_pi_wallets`
  - stores: `pi_uid`, `pi_username`, `wallet_address`, `wallet_secret_id`, `last_pi_balance`, `last_synced_at`, `metadata_json`
- New/updated API behavior:
  - `POST /api/users` accepts optional `piAuth`
  - `POST /api/users/login` accepts optional `piAuth`
  - `POST /api/users/:id/pi-balance/sync` syncs Pi balance using Pi access token

### Important note
- Real private wallet secret key is NOT exposed by Pi SDK/Pi API.
- Supported to store:
  - wallet address
  - uid
  - optional internal `wallet_secret_id` reference (if provided by app workflow)
  - synced balance

## Next recommended steps
1. Upgrade production Node.js from v18 to v20+ (Fastify dependency engine warnings still appear).
2. Add explicit migration SQL file for `user_pi_wallets` (currently table auto-created in route init).
3. Add token refresh/expiry handling for Pi access token in frontend local session.
4. Add admin page/log for Pi wallet link status and last sync health.
