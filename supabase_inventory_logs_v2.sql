create extension if not exists pgcrypto;

create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  action_type text not null,
  qty numeric default 0,
  before_stock numeric,
  after_stock numeric,
  reason text,
  ref_type text,
  ref_id text,
  created_by text,
  created_at timestamptz default now()
);

alter table public.inventory_logs
  alter column created_by type text using created_by::text;

create index if not exists idx_inventory_logs_item_id on public.inventory_logs(item_id);
create index if not exists idx_inventory_logs_action_type on public.inventory_logs(action_type);
create index if not exists idx_inventory_logs_created_at on public.inventory_logs(created_at desc);

alter table public.inventory_logs enable row level security;

drop policy if exists "dev anon select inventory_logs" on public.inventory_logs;
create policy "dev anon select inventory_logs"
on public.inventory_logs for select
to anon
using (true);

drop policy if exists "dev anon insert inventory_logs" on public.inventory_logs;
create policy "dev anon insert inventory_logs"
on public.inventory_logs for insert
to anon
with check (true);

drop policy if exists "dev anon update inventory_logs" on public.inventory_logs;
create policy "dev anon update inventory_logs"
on public.inventory_logs for update
to anon
using (true)
with check (true);

drop policy if exists "dev anon delete inventory_logs" on public.inventory_logs;
create policy "dev anon delete inventory_logs"
on public.inventory_logs for delete
to anon
using (true);

-- 開發測試用 policy：正式上線前請依登入使用者與角色收緊權限。
