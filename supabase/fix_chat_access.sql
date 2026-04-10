alter table public.profiles
  add column if not exists avatar_url text;

drop policy if exists "chats_insert_authenticated" on public.chats;
create policy "chats_insert_authenticated"
  on public.chats for insert
  to authenticated
  with check (true);

drop policy if exists "chat_members_select_member" on public.chat_members;
drop policy if exists "chat_members_select_authenticated" on public.chat_members;
create policy "chat_members_select_authenticated"
  on public.chat_members for select
  to authenticated
  using (true);

drop policy if exists "chat_members_insert_self" on public.chat_members;
drop policy if exists "chat_members_insert_authenticated" on public.chat_members;
create policy "chat_members_insert_authenticated"
  on public.chat_members for insert
  to authenticated
  with check (true);
