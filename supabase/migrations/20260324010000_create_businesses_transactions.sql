-- Businesses table
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

create policy "Users can view own businesses"
  on public.businesses for select using (auth.uid() = owner_id);
create policy "Users can insert own businesses"
  on public.businesses for insert with check (auth.uid() = owner_id);
create policy "Users can update own businesses"
  on public.businesses for update using (auth.uid() = owner_id);
create policy "Users can delete own businesses"
  on public.businesses for delete using (auth.uid() = owner_id);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.handle_updated_at();

-- Transactions table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can view transactions of own businesses"
  on public.transactions for select
  using (exists (
    select 1 from public.businesses where id = business_id and owner_id = auth.uid()
  ));
create policy "Users can insert transactions to own businesses"
  on public.transactions for insert
  with check (exists (
    select 1 from public.businesses where id = business_id and owner_id = auth.uid()
  ));
create policy "Users can update transactions of own businesses"
  on public.transactions for update
  using (exists (
    select 1 from public.businesses where id = business_id and owner_id = auth.uid()
  ));
create policy "Users can delete transactions of own businesses"
  on public.transactions for delete
  using (exists (
    select 1 from public.businesses where id = business_id and owner_id = auth.uid()
  ));

-- Indexes for performance
create index if not exists idx_transactions_business_id on public.transactions(business_id);
create index if not exists idx_transactions_timestamp on public.transactions(timestamp);
create index if not exists idx_transactions_type on public.transactions(type);
create index if not exists idx_businesses_owner_id on public.businesses(owner_id);
