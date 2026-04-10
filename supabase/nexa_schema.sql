create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  username text not null unique,
  role text not null default 'student' check (role in ('student', 'curator', 'teacher')),
  accent_color text not null default '#2795FF',
  bio text not null default 'РЈС‡Р°СЃС‚РЅРёРє Nexa.',
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null check (kind in ('group', 'direct', 'channel')),
  description text not null default '',
  accent_color text not null default '#2795FF',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1500),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

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
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member"
  on public.messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.chat_members cm
      where cm.chat_id = messages.chat_id
        and cm.user_id = auth.uid()
    )
  );

insert into public.chats (id, title, kind, description, accent_color, is_default)
values (
  '11111111-1111-4111-8111-111111111111',
  'Nexa / РћР±С‰РёР№ С‡Р°С‚',
  'group',
  'Р“Р»Р°РІРЅС‹Р№ С‡Р°С‚ СЃРѕРѕР±С‰РµСЃС‚РІР° Nexa.',
  '#2795FF',
  true
)
on conflict (id) do nothing;
