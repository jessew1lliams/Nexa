alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.chats to authenticated;
grant select, insert, update on public.chat_members to authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "chats_select_member" on public.chats;
create policy "chats_select_member"
  on public.chats for select
  to authenticated
  using (
    exists (
      select 1
      from public.chat_members cm
      where cm.chat_id = chats.id
        and cm.user_id = auth.uid()
    )
    or is_default = true
  );

drop policy if exists "chats_insert_authenticated" on public.chats;
create policy "chats_insert_authenticated"
  on public.chats for insert
  to authenticated
  with check (true);

drop policy if exists "chats_update_authenticated" on public.chats;
create policy "chats_update_authenticated"
  on public.chats for update
  to authenticated
  using (true)
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

drop policy if exists "chat_members_update_authenticated" on public.chat_members;
create policy "chat_members_update_authenticated"
  on public.chat_members for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.chat_members cm
      where cm.chat_id = messages.chat_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.is_default = true
    )
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member"
  on public.messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1
        from public.chat_members cm
        where cm.chat_id = messages.chat_id
          and cm.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.chats c
        where c.id = messages.chat_id
          and c.is_default = true
      )
    )
  );
