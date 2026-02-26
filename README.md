# Pi Store Marketplace

Marketplace sederhana berbasis:

- React + Vite (JavaScript)
- Tailwind CSS 4.1
- Supabase (products, orders, order_items)
- Tanpa Supabase Auth (pakai anon key + RLS policy)

## 1) Jalankan lokal

```bash
npm install
cp .env.example .env
npm run dev
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 2) Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor, jalankan file `supabase/schema.sql`.
3. Ambil nilai Project URL dan anon key dari Settings > API.
4. Isi `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_PI_DOMAIN_VERIFIED=false
```

Jika env belum diisi, aplikasi otomatis masuk mode demo dengan data contoh.
Jika domain Pi belum lolos validasi, biarkan `VITE_PI_DOMAIN_VERIFIED=false` agar checkout pakai metode manual.

## 3) Fitur yang sudah dibuat

- Listing produk dari Supabase
- Search + filter kategori
- Keranjang belanja (client-side)
- Checkout menyimpan `orders` dan `order_items` ke Supabase
- Pilihan metode bayar: manual sekarang, Pi Network aktif setelah verifikasi domain

## 5) Lanjutan saat domain Pi belum tervalidasi

1. Operasikan checkout manual dulu (status order: `awaiting_manual_payment`).
2. Simpan bukti bayar/konfirmasi di dashboard admin (bisa ditambah next step).
3. Setelah domain tervalidasi, ubah `.env` menjadi:

```env
VITE_PI_DOMAIN_VERIFIED=true
```

Lalu lanjutkan integrasi `window.Pi` payment flow.

## 4) Build production

```bash
npm run build
npm run preview
```
