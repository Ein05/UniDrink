-- 1. Create Tables
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 120),
  name_en text check (char_length(name_en) <= 120),
  description text check (char_length(description) <= 2000),
  description_en text check (char_length(description_en) <= 2000),
  image_url text,
  price integer not null check (price >= 0),
  category text not null,
  emoji text,
  is_available boolean default true,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

-- Sequence for order code
create sequence if not exists order_code_seq;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null default ('DH' || lpad(nextval('order_code_seq')::text, 6, '0')),
  customer_name text not null check (char_length(customer_name) <= 100),
  customer_phone text not null check (char_length(customer_phone) <= 20),
  address text not null check (char_length(address) <= 255),
  note text check (char_length(note) <= 1000),
  total_price integer not null check (total_price >= 0),
  payment_method text default 'cash' check (payment_method in ('cash', 'transfer')),
  is_paid boolean default false,
  status text default 'pending' check (status in ('pending', 'processing', 'done', 'cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 10),
  price integer not null check (price >= 0)
);

create table if not exists public.settings (
  key text primary key,
  value text not null,
  is_public boolean default true,
  updated_at timestamptz default now()
);

-- 2. RLS Setup
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table settings enable row level security;

-- Policies for products
create policy "Public read products" on products for select to anon using (is_available = true and is_deleted = false);
create policy "Admin all products" on products for all to authenticated using (true);

-- Policies for orders
create policy "No public read orders" on orders for select to anon using (false);
create policy "Admin all orders" on orders for all to authenticated using (true);

-- Policies for items
create policy "Admin all items" on order_items for all to authenticated using (true);

-- Policies for settings
create policy "Public read public settings" on settings for select to anon using (is_public = true);
create policy "Admin all settings" on settings for all to authenticated using (true);

-- 3. RPC for Create Order
create or replace function create_order_with_items(
  p_customer_name  text,
  p_customer_phone text,
  p_address        text,
  p_note           text,
  p_payment_method text,
  p_items          jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_order_code text;
  item         jsonb;
  v_product    record;
  v_quantity   integer;
  v_total      integer := 0;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_payment_method not in ('cash', 'transfer') then
    raise exception 'Invalid payment method';
  end if;

  -- Initial insert
  insert into orders (
    customer_name,
    customer_phone,
    address,
    note,
    payment_method,
    total_price
  )
  values (
    p_customer_name,
    p_customer_phone,
    p_address,
    p_note,
    p_payment_method,
    0
  )
  returning id, order_code
  into v_order_id, v_order_code;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (item->>'quantity')::integer;

    if v_quantity < 1 or v_quantity > 10 then
      raise exception 'Invalid quantity';
    end if;

    select id, name, price
    into v_product
    from products
    where id = (item->>'id')::uuid -- use 'id' from json
      and is_available = true
      and is_deleted = false;

    if not found then
      raise exception 'Product unavailable: %', item->>'name';
    end if;

    insert into order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      price
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.price
    );

    v_total := v_total + (v_product.price * v_quantity);
  end loop;

  -- Update total
  update orders set total_price = v_total where id = v_order_id;

  return v_order_code;
end;
$$;

-- 4. Seed Data
insert into products (name, name_en, price, category, emoji, description, description_en)
values 
('Cà Phê Sữa Đá', 'Iced Coffee with Condensed Milk', 25000, 'coffee', '☕', 'Cà phê rang xay nguyên chất pha phin truyền thống.', 'Traditional Vietnamese filtered coffee with sweet condensed milk.'),
('Bạc Xỉu', 'White Coffee', 29000, 'coffee', '🥛', 'Sự hòa quyện giữa sữa tươi, sữa đặc và coffee.', 'A creamy blend of fresh milk, condensed milk, and a hint of coffee.'),
('Trà Đào Cam Sả', 'Peach Orange Lemongrass Tea', 35000, 'tea', '🍑', 'Trà thảo mộc thanh mát với hương đào và sả.', 'Refreshing herbal tea with peach slices and lemongrass.'),
('Trà Sữa Trân Châu', 'Pearl Milk Tea', 39000, 'tea', '🧋', 'Hương vị trà sữa đậm đà kèm trân châu đen dai giòn.', 'Rich milk tea flavor served with chewy black pearls.'),
('Nước Ép Cam', 'Fresh Orange Juice', 30000, 'juice', '🍊', 'Nước cam nguyên chất 100% giàu Vitamin C.', '100% pure fresh orange juice rich in Vitamin C.'),
('Bánh Croissant', 'Croissant', 22000, 'cake', '🥐', 'Bánh mì bơ tỏi thơm ngon giòn rụm.', 'Flaky and buttery French classic pastry.'),
('Bánh Tiramisu', 'Tiramisu Cake', 45000, 'cake', '🍰', 'Bánh ngọt phong cách Ý với hương vị coffee và mascarpone.', 'Classic Italian dessert with coffee and mascarpone layers.');

insert into settings (key, value, is_public)
values 
('usd_rate', '25450', true),
('delivery_fee', '5000', true),
('is_open', 'true', true);
