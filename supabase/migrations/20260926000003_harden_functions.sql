-- Lock down functions flagged by the Supabase security advisor.

-- Pin search_path on the remaining trigger helpers.
alter function public.normalize_invite_email() set search_path = '';
alter function public.touch_updated_at() set search_path = '';

-- Trigger functions are never called directly (firing a trigger doesn't need EXECUTE).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_tour_owner() from public, anon, authenticated;
revoke execute on function public.guard_tour_members() from public, anon, authenticated;
revoke execute on function public.normalize_invite_email() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Signed-in only. RLS policies (all "to authenticated") need EXECUTE on the access helpers,
-- which only ever report the caller's own role, so they stay callable by authenticated.
revoke execute on function public.tour_role_of(uuid) from public, anon;
revoke execute on function public.is_tour_member(uuid) from public, anon;
revoke execute on function public.can_edit_tour(uuid) from public, anon;
revoke execute on function public.is_tour_admin(uuid) from public, anon;
revoke execute on function public.create_tour(text, text, text) from public, anon;
revoke execute on function public.accept_tour_invite(uuid) from public, anon;
revoke execute on function public.my_pending_invites() from public, anon;
grant execute on function public.tour_role_of(uuid) to authenticated;
grant execute on function public.is_tour_member(uuid) to authenticated;
grant execute on function public.can_edit_tour(uuid) to authenticated;
grant execute on function public.is_tour_admin(uuid) to authenticated;
grant execute on function public.create_tour(text, text, text) to authenticated;
grant execute on function public.accept_tour_invite(uuid) to authenticated;
grant execute on function public.my_pending_invites() to authenticated;
