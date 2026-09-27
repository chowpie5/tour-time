-- Security fixes from an audit that exercised the policies as real users.

-- ---------------------------------------------------------------- budget is money: owner/manager only
-- It lived on tours, which every member (crew, viewers) can read.
create table public.tour_budgets (
  tour_id uuid primary key references public.tours (id) on delete cascade,
  budget jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.tour_budgets (tour_id, budget) select id, budget from public.tours;
alter table public.tours drop column budget;
alter table public.tour_budgets enable row level security;
create policy "budgets: admins all" on public.tour_budgets for all to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));
create trigger touch before update on public.tour_budgets for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- references must stay inside the same tour
-- Foreign keys skip RLS, so a single-column key let one tour point at (and block) another tour's rows.
alter table public.venues add constraint venues_tour_id_id_key unique (tour_id, id);
alter table public.contacts add constraint contacts_tour_id_id_key unique (tour_id, id);
alter table public.days add constraint days_tour_id_id_key unique (tour_id, id);

alter table public.contacts drop constraint contacts_venue_id_fkey,
  add constraint contacts_venue_fkey foreign key (tour_id, venue_id)
    references public.venues (tour_id, id) on delete set null (venue_id);
alter table public.days drop constraint days_venue_id_fkey, drop constraint days_promoter_id_fkey,
  add constraint days_venue_fkey foreign key (tour_id, venue_id)
    references public.venues (tour_id, id) on delete set null (venue_id),
  add constraint days_promoter_fkey foreign key (tour_id, promoter_id)
    references public.contacts (tour_id, id) on delete set null (promoter_id);
alter table public.expenses drop constraint expenses_day_id_fkey,
  add constraint expenses_day_fkey foreign key (tour_id, day_id)
    references public.days (tour_id, id) on delete set null (day_id);
alter table public.settlements drop constraint settlements_day_id_fkey,
  add constraint settlements_day_fkey foreign key (tour_id, day_id)
    references public.days (tour_id, id) on delete cascade;
alter table public.documents drop constraint documents_day_id_fkey,
  add constraint documents_day_fkey foreign key (tour_id, day_id)
    references public.days (tour_id, id) on delete set null (day_id);

-- A document row may only point at a file in its own tour's storage folder.
alter table public.documents add constraint documents_path_in_tour
  check (storage_path like tour_id::text || '/%');

-- Authorship columns always record the real signed-in user (kept unchanged on update).
create function public.stamp_author() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0],
      case when tg_op = 'INSERT' then to_jsonb(auth.uid()) else to_jsonb(old) -> tg_argv[0] end));
  end if;
  return new;
end $$;
revoke execute on function public.stamp_author() from public, anon, authenticated;
create trigger stamp_author before insert or update on public.expenses
  for each row execute function public.stamp_author('created_by');
create trigger stamp_author before insert or update on public.documents
  for each row execute function public.stamp_author('uploaded_by');

-- ---------------------------------------------------------------- membership
-- Joining happens only through create_tour() and accept_tour_invite(), so nobody is added without consent.
-- Admins may change a member's role and title, not which user or tour the row belongs to.
drop policy "members: admins add" on public.tour_members;
revoke insert, update on public.tour_members from anon, authenticated;
grant update (role, title) on public.tour_members to authenticated;

-- Deleting a tour cascades to its members; don't apply owner rules to a tour that is going away
-- (previously a tour with two owners could not be deleted).
create or replace function public.guard_tour_members() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  caller_role public.tour_role := public.tour_role_of(coalesce(new.tour_id, old.tour_id));
  touches_owner boolean := (tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner');
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.tours where id = old.tour_id) then
    return old;
  end if;
  -- Trigger-internal inserts (tour creation) run without a caller role check.
  if auth.uid() is not null and touches_owner and caller_role is distinct from 'owner'
     and not (tg_op = 'INSERT' and pg_trigger_depth() > 1) then
    raise exception 'Only an owner can change owner memberships';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.tour_members
                     where tour_id = old.tour_id and role = 'owner' and user_id <> old.user_id) then
    raise exception 'A tour must keep at least one owner';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.guard_tour_members() from public, anon, authenticated;

-- ---------------------------------------------------------------- tours & profiles: only editable fields
revoke insert, update on public.tours from anon, authenticated;
grant update (name, artist, currency) on public.tours to authenticated;

revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, phone, job_title) on public.profiles to authenticated;
alter table public.profiles add constraint profiles_avatar_https
  check (avatar_url is null or avatar_url ~ '^https://');

-- Sign-up metadata is user-supplied: keep only an https avatar and a sane-length name.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''), 200),
    case when avatar ~ '^https://' then avatar end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Deleting an account shouldn't be blocked by having created a tour or sent an invite.
alter table public.tours alter column created_by drop not null,
  drop constraint tours_created_by_fkey,
  add constraint tours_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;
alter table public.tour_invites alter column invited_by drop not null,
  drop constraint tour_invites_invited_by_fkey,
  add constraint tour_invites_invited_by_fkey foreign key (invited_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------- invites
-- Inviter is always the signed-in admin; after sending, only role and expiry can change.
drop policy "invites: admins all" on public.tour_invites;
create policy "invites: admins read" on public.tour_invites for select to authenticated
  using (public.is_tour_admin(tour_id));
create policy "invites: admins send as self" on public.tour_invites for insert to authenticated
  with check (public.is_tour_admin(tour_id) and invited_by = auth.uid());
create policy "invites: admins change" on public.tour_invites for update to authenticated
  using (public.is_tour_admin(tour_id)) with check (public.is_tour_admin(tour_id));
create policy "invites: admins revoke" on public.tour_invites for delete to authenticated
  using (public.is_tour_admin(tour_id));
revoke update on public.tour_invites from anon, authenticated;
grant update (role, expires_at) on public.tour_invites to authenticated;

-- Invites are claimed only by an account that has verified the invited email address
-- (the JWT email claim can belong to an unconfirmed sign-up).
create function public.my_verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$$;
revoke execute on function public.my_verified_email() from public, anon, authenticated;

create or replace function public.accept_tour_invite(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.tour_invites;
begin
  select * into inv from public.tour_invites
  where token = invite_token and accepted_at is null and expires_at > now();
  if inv is null then raise exception 'Invite is invalid or has expired'; end if;
  if inv.email is distinct from public.my_verified_email() then
    raise exception 'This invite was sent to a different email address, or your email is not verified yet';
  end if;
  insert into public.tour_members (tour_id, user_id, role) values (inv.tour_id, auth.uid(), inv.role)
  on conflict (tour_id, user_id) do nothing;
  update public.tour_invites set accepted_at = now() where id = inv.id;
  return inv.tour_id;
end $$;

create or replace function public.my_pending_invites()
returns table (token uuid, tour_id uuid, tour_name text, artist text, role public.tour_role, invited_by_name text)
language sql stable security definer set search_path = '' as $$
  select i.token, t.id, t.name, t.artist, i.role, p.full_name
  from public.tour_invites i
  join public.tours t on t.id = i.tour_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = public.my_verified_email() and i.accepted_at is null and i.expires_at > now()
$$;

-- ---------------------------------------------------------------- chat
alter table public.messages add constraint messages_channel_len check (length(channel) between 1 and 40);

-- Realtime broadcast/presence (typing, who's online) on private channels named "tour:<tour id>":
-- only members of that tour may join or send.
create function public.tour_from_topic(topic text) returns uuid
language sql immutable set search_path = '' as $$
  select case when topic ~ '^tour:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then substr(topic, 6)::uuid end
$$;
revoke execute on function public.tour_from_topic(text) from public, anon;
grant execute on function public.tour_from_topic(text) to authenticated;

create policy "realtime: tour members receive" on realtime.messages for select to authenticated
  using (public.is_tour_member(public.tour_from_topic(realtime.topic())));
create policy "realtime: tour members send" on realtime.messages for insert to authenticated
  with check (public.is_tour_member(public.tour_from_topic(realtime.topic())));
