create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Umum',
  image_url text,
  price numeric(12, 0) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  buyer_name text not null,
  buyer_phone text not null,
  buyer_address text not null,
  total_amount numeric(12, 0) not null check (total_amount >= 0),
  payment_method text not null default 'manual',
  payment_status text not null default 'awaiting_manual_payment',
  payment_reference text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists payment_method text not null default 'manual';
alter table public.orders add column if not exists payment_status text not null default 'awaiting_manual_payment';
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists user_id uuid;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 0) not null check (unit_price >= 0),
  line_total numeric(12, 0) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key,
  pi_uid text,
  pi_username text,
  pi_access_token text,
  last_pi_auth_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products"
  on public.products
  for select
  using (is_active = true);

drop policy if exists "Public insert orders" on public.orders;
create policy "Public insert orders"
  on public.orders
  for insert
  with check (true);

drop policy if exists "Users update own orders" on public.orders;
create policy "Users update own orders"
  on public.orders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Public insert order_items" on public.order_items;
create policy "Public insert order_items"
  on public.order_items
  for insert
  with check (true);

drop policy if exists "Users upsert own profile" on public.user_profiles;
create policy "Users upsert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

grant usage on schema public to anon;
grant select on public.products to anon;
grant insert on public.orders to anon;
grant insert on public.order_items to anon;
grant select, insert, update on public.user_profiles to authenticated;

insert into public.products (name, description, category, image_url, price, stock)
values
  (
    'Tasbih Kayu Premium',
    'Tasbih handmade 99 butir dari kayu sonokeling.',
    'Aksesoris',
    'https://images.unsplash.com/photo-1576504674429-79c3f84f8f9f?auto=format&fit=crop&w=1200&q=80',
    145000,
    35
  ),
  (
    'Madu Hutan Sumbawa',
    'Madu murni 500ml, cocok untuk konsumsi harian.',
    'Kesehatan',
    'https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=1200&q=80',
    130000,
    42
  ),
  (
    'Sarung Tenun Eksklusif',
    'Sarung tenun premium dengan bahan adem dan nyaman.',
    'Fashion',
    'https://images.unsplash.com/photo-1618886487325-f665032b635b?auto=format&fit=crop&w=1200&q=80',
    275000,
    18
  ),
  (
    'Kurma Sukari 1kg',
    'Kurma manis grade A, cocok untuk hadiah dan konsumsi.',
    'Makanan',
    'https://images.unsplash.com/photo-1710335141798-331ecfef95c6?auto=format&fit=crop&w=1200&q=80',
    98000,
    60
  )
on conflict do nothing;
