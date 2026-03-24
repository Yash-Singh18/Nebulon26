-- =============================================
-- Team Tracking Tables — CLEAN IDEMPOTENT MIGRATION
-- Run this in Supabase SQL Editor to set up / reset team tables
-- =============================================


-- =============================================
-- 0. DROP EVERYTHING (safe re-run)
-- =============================================

-- Drop realtime (ignore if not present)
do $$ begin
  alter publication supabase_realtime drop table public.team_messages;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime drop table public.team_transactions;
exception when others then null;
end $$;

-- Drop triggers
drop trigger if exists team_rooms_updated_at on public.team_rooms;

-- Drop indexes
drop index if exists idx_team_rooms_admin;
drop index if exists idx_team_rooms_code;
drop index if exists idx_team_members_room;
drop index if exists idx_team_members_user;
drop index if exists idx_team_tx_room;
drop index if exists idx_team_tx_added_by;
drop index if exists idx_team_tx_status;
drop index if exists idx_team_tx_timestamp;
drop index if exists idx_team_messages_room;
drop index if exists idx_team_messages_created;
drop index if exists idx_admin_requests_room;

-- Drop tables (cascade drops policies automatically)
drop table if exists public.admin_requests cascade;
drop table if exists public.team_messages cascade;
drop table if exists public.team_transactions cascade;
drop table if exists public.team_members cascade;
drop table if exists public.team_rooms cascade;

-- Drop functions
drop function if exists public.is_team_member(uuid, uuid);
drop function if exists public.is_team_admin(uuid, uuid);
drop function if exists public.lookup_room_by_code(text);

-- Drop old profiles policy for team visibility (if exists)
drop policy if exists "Team members can view teammates profiles" on public.profiles;

-- =============================================
-- 1. CREATE TABLES
-- =============================================

create table public.team_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room_code text not null unique,
  description text,
  admin_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.team_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  department text,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

create table public.team_transactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.team_rooms(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references auth.users(id),
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.team_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.team_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  mentions text[] default '{}',
  created_at timestamptz not null default now()
);

create table public.admin_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.team_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- =============================================
-- 2. HELPER FUNCTIONS (security definer = bypass RLS)
-- =============================================

create or replace function public.is_team_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

create or replace function public.is_team_admin(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_rooms
    where id = p_room_id and admin_id = p_user_id
  );
$$;

-- Lookup room by code (bypasses RLS so non-members can find rooms to join)
create or replace function public.lookup_room_by_code(p_code text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select row_to_json(r) from (
    select id, name, room_code, admin_id, created_at
    from public.team_rooms
    where room_code = upper(trim(p_code))
  ) r;
$$;

-- =============================================
-- 3. ENABLE RLS
-- =============================================

alter table public.team_rooms enable row level security;
alter table public.team_members enable row level security;
alter table public.team_transactions enable row level security;
alter table public.team_messages enable row level security;
alter table public.admin_requests enable row level security;

-- =============================================
-- 4. RLS POLICIES
-- =============================================

-- Team Rooms
create policy "rooms_select" on public.team_rooms for select
  using (auth.uid() = admin_id or public.is_team_member(id, auth.uid()));
create policy "rooms_insert" on public.team_rooms for insert
  with check (auth.uid() = admin_id);
create policy "rooms_update" on public.team_rooms for update
  using (auth.uid() = admin_id);
create policy "rooms_delete" on public.team_rooms for delete
  using (auth.uid() = admin_id);

-- Team Members
create policy "members_select" on public.team_members for select
  using (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()));
create policy "members_insert" on public.team_members for insert
  with check (auth.uid() = user_id);
create policy "members_update" on public.team_members for update
  using (public.is_team_admin(room_id, auth.uid()) or auth.uid() = user_id);
create policy "members_delete" on public.team_members for delete
  using (public.is_team_admin(room_id, auth.uid()) or auth.uid() = user_id);

-- Team Transactions
create policy "tx_select" on public.team_transactions for select
  using (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()));
create policy "tx_insert" on public.team_transactions for insert
  with check (
    auth.uid() = added_by
    and (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()))
  );
create policy "tx_update" on public.team_transactions for update
  using (public.is_team_admin(room_id, auth.uid()));
create policy "tx_delete" on public.team_transactions for delete
  using (public.is_team_admin(room_id, auth.uid()));

-- Team Messages
create policy "msg_select" on public.team_messages for select
  using (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()));
create policy "msg_insert" on public.team_messages for insert
  with check (
    auth.uid() = user_id
    and (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()))
  );

-- Admin Requests
create policy "areq_select" on public.admin_requests for select
  using (public.is_team_member(room_id, auth.uid()) or public.is_team_admin(room_id, auth.uid()));
create policy "areq_insert" on public.admin_requests for insert
  with check (auth.uid() = user_id and public.is_team_member(room_id, auth.uid()));
create policy "areq_update" on public.admin_requests for update
  using (public.is_team_admin(room_id, auth.uid()));

-- =============================================
-- 5. FIX PROFILES: allow any authenticated user to read profiles
--    (needed for team members to see each other's names)
-- =============================================

-- Drop the restrictive "own profile only" SELECT policy
drop policy if exists "Users can view own profile" on public.profiles;

-- Allow any logged-in user to read any profile (names/usernames are not sensitive)
create policy "Authenticated users can view profiles"
  on public.profiles for select
  using (auth.uid() is not null);

-- =============================================
-- 6. TRIGGERS & INDEXES
-- =============================================

create trigger team_rooms_updated_at
  before update on public.team_rooms
  for each row execute function public.handle_updated_at();

create index idx_team_rooms_admin on public.team_rooms(admin_id);
create index idx_team_rooms_code on public.team_rooms(room_code);
create index idx_team_members_room on public.team_members(room_id);
create index idx_team_members_user on public.team_members(user_id);
create index idx_team_tx_room on public.team_transactions(room_id);
create index idx_team_tx_added_by on public.team_transactions(added_by);
create index idx_team_tx_status on public.team_transactions(status);
create index idx_team_tx_timestamp on public.team_transactions(timestamp);
create index idx_team_messages_room on public.team_messages(room_id);
create index idx_team_messages_created on public.team_messages(created_at);
create index idx_admin_requests_room on public.admin_requests(room_id);

-- =============================================
-- 7. ENABLE REALTIME
-- =============================================

do $$ begin
  alter publication supabase_realtime add table public.team_messages;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.team_transactions;
exception when others then null;
end $$;
