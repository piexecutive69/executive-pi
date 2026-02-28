# Pi Store Backend (Fastify + MySQL)

Backend API untuk alur marketplace lokal: katalog produk, cart, checkout/order, dan PPOB.

## Stack
- Fastify
- MySQL (`localhost`, `root`, password kosong by default)
- dotenv

## Setup
1. Masuk ke folder backend:
```bash
cd D:\web\pi-store\backend
```

2. Install dependency:
```bash
npm install
```

3. Copy env:
```bash
copy .env.example .env
```

4. Buat database + tabel + seed:
```bash
mysql -u root < sql/schema.sql
mysql -u root pi_marketplace < sql/seed.sql
```

5. Jalankan API:
```bash
npm run dev
```

Server default: `http://localhost:3100`
Swagger UI: `http://localhost:3100/docs`
OpenAPI JSON: `http://localhost:3100/docs/json`

## Security (x-api-key)
- Semua endpoint `/api/*` wajib header `x-api-key`.
- Nilai key diambil dari `.env` -> `API_KEY`.
- Endpoint callback pihak ketiga yang dikecualikan:
  - `POST /api/orders/duitku/callback`
  - `POST /api/wallet/topup/duitku/callback`
  - `GET /api/health`

## Alur Marketplace
1. `GET /api/products` untuk ambil katalog.
2. `GET /api/products/:id` untuk detail produk.
3. `POST /api/cart/items` untuk tambah item ke cart.
4. `GET /api/cart?userId=1` untuk lihat keranjang.
5. `PATCH /api/cart/items/:itemId` update qty, `DELETE` untuk hapus item.
6. `POST /api/orders/checkout` untuk checkout (IDR/Rupiah only):
   - validasi stok
   - hitung subtotal/total dalam IDR
   - insert order + order_items
   - potong stok produk
   - metode pembayaran:
     - `wallet_idr` (potong saldo user langsung)
     - `duitku` (buat transaksi payment pending)
   - kosongkan cart user
7. `GET /api/orders?userId=1` untuk histori order.
8. `GET /api/orders/:orderId?userId=1` untuk detail order.

## Alur PPOB
1. `GET /api/ppob/services` untuk daftar layanan.
2. `POST /api/ppob/transactions` untuk transaksi PPOB.
3. `GET /api/ppob/transactions?userId=1` untuk histori PPOB user.

## Alur Wallet Topup (Duitku)
1. `POST /api/wallet/topup/duitku`:
   - buat invoice topup
   - simpan ke `wallet_topups` + `payment_transactions`
   - return `paymentUrl`
2. `POST /api/wallet/topup/duitku/callback`:
   - update status topup
   - tambah `users.idr_balance` jika paid
3. `GET /api/wallet/balance?userId=1`:
   - ambil saldo IDR & PI user

## Callback Checkout Duitku
1. Checkout order dengan:
```json
{
  "userId": 1,
  "paymentMethod": "duitku",
  "shippingAddress": "Alamat tujuan"
}
```
2. API akan membuat order status `waiting_payment` dan `payment_transactions` pending.
3. Kirim callback pembayaran ke `POST /api/orders/duitku/callback`:
   - jika paid/success -> order jadi `paid`
   - jika gagal -> order jadi `cancelled` dan stok dikembalikan

## Sinkron Digiflazz Price List
Signature:
- Formula: `md5(username + apiKey + "pricelist")`
- Endpoint Digiflazz: `POST https://api.digiflazz.com/v1/price-list`
- Body:
  - `{"cmd":"prepaid","username":"...","sign":"..."}`
  - `{"cmd":"pascabayar","username":"...","sign":"..."}`

Backend endpoint sync lokal:
```bash
POST /api/digiflazz/sync/price-list
{
  "cmd": "all",
  "dryRun": false
}
```

`cmd`:
- `prepaid` / `prabayar`
- `pascabayar` / `pasca`
- `all`

Mapping:
- Response `prepaid` -> tabel `digiflazz_prepaid_products`
- Response `pascabayar` -> tabel `digiflazz_postpaid_products`

## Endpoint Ringkas
- `GET /api/health`
- `GET /api/users/:id`
- `POST /api/users`
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/cart?userId=`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId?userId=`
- `POST /api/orders/checkout`
- `POST /api/orders/duitku/callback`
- `GET /api/orders?userId=`
- `GET /api/orders/:orderId?userId=`
- `GET /api/ppob/services`
- `POST /api/ppob/transactions`
- `GET /api/ppob/transactions?userId=`
- `GET /api/wallet/balance?userId=`
- `POST /api/wallet/topup/duitku`
- `POST /api/wallet/topup/duitku/callback`
- `POST /api/digiflazz/sync/price-list`
