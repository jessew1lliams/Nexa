create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null,
  username text not null unique,
  role text not null default 'student' check (role in ('student', 'curator', 'teacher')),
  accent_color text not null default '#2795FF',
  avatar_url text,
  bio text not null default 'РЈС‡Р°СЃС‚РЅРёРє Nexa.',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

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

create or replace function public.nexa_resolve_username(base_username text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  suffix text := substr(replace(user_id::text, '-', ''), 1, 8);
begin
  normalized := lower(regexp_replace(coalesce(nullif(trim(base_username), ''), ''), '[^a-z0-9_]+', '', 'g'));

  if normalized = '' then
    normalized := 'user_' || suffix;
  end if;

  normalized := left(normalized, 24);

  if not exists (
    select 1
    from public.profiles
    where username = normalized
      and id <> user_id
  ) then
    return normalized;
  end if;

  normalized := left(normalized, 15) || '_' || suffix;
  return left(normalized, 24);
end
$$;

create or replace function public.nexa_sync_user_profile(
  p_user_id uuid,
  p_email text,
  p_raw_user_meta_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_username_seed text;
  v_username text;
  v_avatar_url text;
begin
  insert into public.chats (id, title, kind, description, accent_color, is_default)
  values (
    '11111111-1111-4111-8111-111111111111',
    'Nexa / Общий чат',
    'group',
    'Главный чат сообщества Nexa.',
    '#2795FF',
    true
  )
  on conflict (id) do nothing;

  v_full_name := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'Пользователь Nexa'
  );

  v_username_seed := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'username'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'screen_name'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'domain'), ''),
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
    'user_' || substr(replace(p_user_id::text, '-', ''), 1, 8)
  );

  v_username := public.nexa_resolve_username(v_username_seed, p_user_id);

  v_avatar_url := coalesce(
    nullif(trim(p_raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'picture'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'photo'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'photo_200'), ''),
    nullif(trim(p_raw_user_meta_data ->> 'photo_100'), '')
  );

  insert into public.profiles (id, email, full_name, username, role, accent_color, avatar_url, bio)
  values (
    p_user_id,
    p_email,
    v_full_name,
    v_username,
    'student',
    '#2795FF',
    v_avatar_url,
    'Участник Nexa.'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        username = excluded.username,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        accent_color = coalesce(public.profiles.accent_color, excluded.accent_color);

  insert into public.chat_members (chat_id, user_id)
  values ('11111111-1111-4111-8111-111111111111', p_user_id)
  on conflict (chat_id, user_id) do nothing;
end
$$;

create or replace function public.nexa_sync_auth_user_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.nexa_sync_user_profile(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end
$$;

drop trigger if exists nexa_sync_auth_user on auth.users;
create trigger nexa_sync_auth_user
  after insert or update on auth.users
  for each row
  execute function public.nexa_sync_auth_user_trigger();

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.chats to authenticated;
grant select, insert, update on public.chat_members to authenticated;
grant select, insert on public.messages to authenticated;

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

do $$
declare
  auth_user record;
begin
  for auth_user in
    select id, email, raw_user_meta_data
    from auth.users
  loop
    perform public.nexa_sync_user_profile(auth_user.id, auth_user.email, coalesce(auth_user.raw_user_meta_data, '{}'::jsonb));
  end loop;
end
$$;
