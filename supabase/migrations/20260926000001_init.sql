-- Tour Time: accounts, tours, membership and shared tour data.
-- Access model: you can only see a tour (and everything in it) if you are a member.
--   owner   – full control, including deleting the tour and managing other owners
--   manager – full control of tour data, money and members (except owners)
--   crew    – edit schedule, advancing, directory, docs; no money
--   viewer  – read-only; no money

create type public.tour_role as enum ('owner', 'manager', 'crew', 'viewer');
create type public.day_type as enum ('show', 'travel', 'off');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- tours & members
create table public.tours (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  artist text not null default '',
  currency text not null default 'USD',
  budget jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tour_members (
  tour_id uuid not null references public.tours (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.tour_role not null default 'crew',
  title text, -- e.g. "FOH Engineer"
  joined_at timestamptz not null default now(),
  primary key (tour_id, user_id)
);
create index tour_members_user_idx on public.tour_members (user_id);

create table public.tour_invites (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  email text not null check (email = lower(email)), -- store lowercased
  role public.tour_role not null default 'crew' check (role <> 'owner'), -- promote to owner after joining
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  unique (tour_id, email)
);

create function public.normalize_invite_email() returns trigger language plpgsql as $$
begin new.email = lower(trim(new.email)); return new; end $$;
create trigger normalize_email before insert or update on public.tour_invites
  for each row execute function public.normalize_invite_email();

-- Helper checks. SECURITY DEFINER so policies on tour_members don't recurse.
create function public.tour_role_of(t uuid) returns public.tour_role
language sql stable security definer set search_path = '' as $$
  select role from public.tour_members where tour_id = t and user_id = auth.uid()
$$;

create function public.is_tour_member(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tour_members where tour_id = t and user_id = auth.uid())
$$;

create function public.can_edit_tour(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.tour_role_of(t) in ('owner', 'manager', 'crew'), false)
$$;

create function public.is_tour_admin(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.tour_role_of(t) in ('owner', 'manager'), false)
$$;

-- Whoever creates a tour becomes its owner.
create function public.add_tour_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tour_members (tour_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;

create trigger on_tour_created after insert on public.tours
  for each row execute function public.add_tour_owner();

-- Create a tour (the caller becomes its owner). Tours are created only through this function,
-- so the new row is visible to its creator via membership as soon as it exists.
create function public.create_tour(tour_name text, tour_artist text default '', tour_currency text default 'USD')
returns public.tours
language plpgsql security definer set search_path = '' as $$
declare
  t public.tours;
begin
  if auth.uid() is null then raise exception 'Sign in to create a tour'; end if;
  insert into public.tours (name, artist, currency, created_by)
  values (tour_name, coalesce(tour_artist, ''), coalesce(tour_currency, 'USD'), auth.uid())
  returning * into t;
  return t;
end $$;

-- Membership guard rails: only owners grant/revoke/alter owner rights, and a tour always keeps an owner.
create function public.guard_tour_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  caller_role public.tour_role := public.tour_role_of(coalesce(new.tour_id, old.tour_id));
  touches_owner boolean := (tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner');
begin
  -- Trigger-internal inserts (tour creation, invite acceptance) run without a caller role check.
  if auth.uid() is not null and touches_owner and caller_role is distinct from 'owner'
     and not (tg_op = 'INSERT' and pg_trigger_depth() > 1) then
    raise exception 'Only an owner can change owner memberships';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.tours where id = old.tour_id)
     and not exists (select 1 from public.tour_members
                     where tour_id = old.tour_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'A tour must keep at least one owner';
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_tour_members before insert or update or delete on public.tour_members
  for each row execute function public.guard_tour_members();

-- Accept an invite for the signed-in user's email address.
create function public.accept_tour_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.tour_invites;
begin
  select * into inv from public.tour_invites
  where token = invite_token and accepted_at is null and expires_at > now();
  if inv is null then raise exception 'Invite is invalid or has expired'; end if;
  if inv.email <> lower(auth.jwt() ->> 'email') then
    raise exception 'This invite was sent to a different email address';
  end if;
  insert into public.tour_members (tour_id, user_id, role) values (inv.tour_id, auth.uid(), inv.role)
  on conflict (tour_id, user_id) do nothing;
  update public.tour_invites set accepted_at = now() where id = inv.id;
  return inv.tour_id;
end $$;

-- Invites waiting for the signed-in user (so the app can show "You've been invited to…").
create function public.my_pending_invites()
returns table (token uuid, tour_id uuid, tour_name text, artist text, role public.tour_role, invited_by_name text)
language sql stable security definer set search_path = '' as $$
  select i.token, t.id, t.name, t.artist, i.role, p.full_name
  from public.tour_invites i
  join public.tours t on t.id = i.tour_id
  join public.profiles p on p.id = i.invited_by
  where i.email = lower(auth.jwt() ->> 'email') and i.accepted_at is null and i.expires_at > now()
$$;

-- ---------------------------------------------------------------- tour data
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  name text not null,
  address text not null default '',
  city text not null default '',
  capacity integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  name text not null,
  role text not null default '',
  category text not null default 'other'
    check (category in ('venue', 'promoter', 'crew', 'production', 'band', 'vendor', 'other')),
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.advance_templates (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  name text not null,
  sections jsonb not null default '[]'::jsonb, -- [{id,title,fields:[{id,label,type,scheduleKey?}]}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  date date not null,
  type public.day_type not null default 'show',
  city text not null default '',
  venue_id uuid references public.venues (id) on delete set null,
  promoter_id uuid references public.contacts (id) on delete set null,
  notes text not null default '',
  schedule jsonb not null default '[]'::jsonb, -- [{id,time,label,key?}]
  travel jsonb not null default '[]'::jsonb,   -- [{id,mode,carrier,...}]
  hotel jsonb,                                 -- {name,address,...}
  advance jsonb,                               -- {templateId,values,confirmed}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index days_tour_date_idx on public.days (tour_id, date);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  day_id uuid references public.days (id) on delete set null,
  date date not null default current_date,
  category text not null,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  paid_by text not null default '',
  method text not null default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_tour_idx on public.expenses (tour_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  day_id uuid not null unique references public.days (id) on delete cascade,
  deal_type text not null default 'versus' check (deal_type in ('guarantee', 'versus', 'door')),
  guarantee numeric(12, 2) not null default 0,
  percentage numeric(5, 2) not null default 85,
  ticket_price numeric(10, 2) not null default 0,
  tickets_sold integer not null default 0,
  comps integer not null default 0,
  taxes_and_fees numeric(12, 2) not null default 0,
  show_expenses numeric(12, 2) not null default 0,
  merch_gross numeric(12, 2) not null default 0,
  merch_venue_cut numeric(5, 2) not null default 20,
  deductions numeric(12, 2) not null default 0,
  notes text not null default '',
  settled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  day_id uuid references public.days (id) on delete set null,
  name text not null,
  category text not null default 'other',
  storage_path text not null unique, -- "<tour_id>/<uuid>.<ext>" in the tour-documents bucket
  size bigint not null default 0,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours (id) on delete cascade,
  channel text not null default 'general',
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_tour_channel_idx on public.messages (tour_id, channel, created_at);

-- Keep updated_at current.
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch before update on public.tours for each row execute function public.touch_updated_at();
create trigger touch before update on public.advance_templates for each row execute function public.touch_updated_at();
create trigger touch before update on public.days for each row execute function public.touch_updated_at();
create trigger touch before update on public.settlements for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.tours enable row level security;
alter table public.tour_members enable row level security;
alter table public.tour_invites enable row level security;
alter table public.venues enable row level security;
alter table public.contacts enable row level security;
alter table public.advance_templates enable row level security;
alter table public.days enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;

-- Profiles: see yourself and anyone you tour with; edit only yourself.
create policy "profiles: read self and tourmates" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.tour_members mine
    join public.tour_members theirs on theirs.tour_id = mine.tour_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id));
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Tours
create policy "tours: members read" on public.tours for select to authenticated
  using (public.is_tour_member(id));
create policy "tours: admins update" on public.tours for update to authenticated
  using (public.is_tour_admin(id)) with check (public.is_tour_admin(id));
create policy "tours: owners delete" on public.tours for delete to authenticated
  using (public.tour_role_of(id) = 'owner');

-- Members: members see the roster; admins add/change/remove; anyone may leave.
create policy "members: read roster" on public.tour_members for select to authenticated
  using (public.is_tour_member(tour_id));
create policy "members: admins add" on public.tour_members for insert to authenticated
  with check (public.is_tour_admin(tour_id));
create policy "members: admins change" on public.tour_members for update to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));
create policy "members: admins remove or self leave" on public.tour_members for delete to authenticated
  using (public.is_tour_admin(tour_id) or user_id = auth.uid());

-- Invites: admins manage.
create policy "invites: admins all" on public.tour_invites for all to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));

-- Shared tour data: members read; owner/manager/crew write.
do $$
declare t text;
begin
  foreach t in array array['venues', 'contacts', 'advance_templates', 'days', 'documents'] loop
    execute format('create policy "%1$s: members read" on public.%1$I for select to authenticated using (public.is_tour_member(tour_id))', t);
    execute format('create policy "%1$s: editors insert" on public.%1$I for insert to authenticated with check (public.can_edit_tour(tour_id))', t);
    execute format('create policy "%1$s: editors update" on public.%1$I for update to authenticated using (public.can_edit_tour(tour_id)) with check (public.can_edit_tour(tour_id))', t);
    execute format('create policy "%1$s: editors delete" on public.%1$I for delete to authenticated using (public.can_edit_tour(tour_id))', t);
  end loop;
end $$;

-- Money: owner/manager only.
create policy "expenses: admins all" on public.expenses for all to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));
create policy "settlements: admins all" on public.settlements for all to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));

-- Chat: members read and post as themselves; delete own messages (admins can moderate).
create policy "messages: members read" on public.messages for select to authenticated
  using (public.is_tour_member(tour_id));
create policy "messages: members post as self" on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_tour_member(tour_id));
create policy "messages: delete own or moderate" on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_tour_admin(tour_id));

-- Live updates for chat, schedule and roster changes.
alter publication supabase_realtime add table public.messages, public.days, public.tour_members;
