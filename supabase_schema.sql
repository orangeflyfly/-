create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists profiles (
  id uuid primary key,
  display_name text,
  role text default 'staff',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  part_no text,
  name text not null,
  spec text,
  type text not null check (type in ('product','package','consumable')),
  unit text,
  stock numeric default 0,
  min_stock numeric default 0,
  purchase_cycle_days integer default 0,
  supplier_note text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists inventory_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  action_type text not null,
  qty numeric default 0,
  before_stock numeric,
  after_stock numeric,
  reason text,
  ref_type text,
  ref_id text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  warehouse text,
  location_code text,
  qty numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bom_items (
  id uuid primary key default gen_random_uuid(),
  product_item_id uuid references items(id) on delete cascade,
  material_item_id uuid references items(id) on delete cascade,
  qty_per_unit numeric default 0,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  qty numeric default 0,
  customer text,
  order_no text,
  owner text,
  scheduled_date date,
  status text default 'pending',
  note text,
  shipped_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_items_part_no on items(part_no);
create index if not exists idx_items_type_active on items(type, active);
create index if not exists idx_inventory_logs_item_id on inventory_logs(item_id);
create index if not exists idx_locations_item_id on locations(item_id);
create index if not exists idx_locations_code on locations(location_code);
create index if not exists idx_bom_items_product on bom_items(product_item_id);
create index if not exists idx_bom_items_material on bom_items(material_item_id);
create index if not exists idx_schedules_item_date on schedules(item_id, scheduled_date);
create index if not exists idx_schedules_status on schedules(status);

drop trigger if exists trg_items_updated_at on items;
create trigger trg_items_updated_at before update on items
for each row execute function set_updated_at();

drop trigger if exists trg_locations_updated_at on locations;
create trigger trg_locations_updated_at before update on locations
for each row execute function set_updated_at();

drop trigger if exists trg_bom_items_updated_at on bom_items;
create trigger trg_bom_items_updated_at before update on bom_items
for each row execute function set_updated_at();

drop trigger if exists trg_schedules_updated_at on schedules;
create trigger trg_schedules_updated_at before update on schedules
for each row execute function set_updated_at();

-- RLS 預留：正式上線前可依 profiles.role 補上 policies。
-- alter table items enable row level security;
-- alter table inventory_logs enable row level security;
-- alter table locations enable row level security;
-- alter table bom_items enable row level security;
-- alter table schedules enable row level security;
-- alter table profiles enable row level security;
