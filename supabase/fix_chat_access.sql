drop policy if exists "chat_members_select_member" on public.chat_members;
drop policy if exists "chat_members_select_authenticated" on public.chat_members;

create policy "chat_members_select_authenticated"
  on public.chat_members for select
  to authenticated
  using (true);
