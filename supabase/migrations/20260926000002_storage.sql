-- Private bucket for contracts, riders, stage plots. Files live at "<tour_id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit)
values ('tour-documents', 'tour-documents', false, 52428800) -- 50 MB
on conflict (id) do nothing;

create policy "tour docs: members read" on storage.objects for select to authenticated
  using (bucket_id = 'tour-documents' and public.is_tour_member(((storage.foldername(name))[1])::uuid));
create policy "tour docs: editors upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'tour-documents' and public.can_edit_tour(((storage.foldername(name))[1])::uuid));
create policy "tour docs: editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tour-documents' and public.can_edit_tour(((storage.foldername(name))[1])::uuid));
