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
