-- Nudge (PLAN-4 2.1): player profiles with a public id. Only adds new objects; no existing table is touched.
-- Run this in the Supabase SQL Editor (or `supabase db push` once the CLI is linked to the project).
--
-- Every account gets one profile: the trainer name from the game's intro plus a unique tag 1000-9999, shown as "Name #1452".
-- The tag is handed out on the server by `ensure_profile()`; when all 4-digit numbers are taken it continues with 5 digits (10000-99999).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 10),
  tag int not null unique check (tag between 1000 and 99999),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everybody who is signed in can read names and tags (to find opponents and show ladders).
create policy "profiles readable" on public.profiles for select to authenticated using (true);
-- The owner may change the name. The tag cannot be changed from the client (column privileges below), and rows are only created by ensure_profile().
create policy "profiles own name" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- A free tag: 4 digits while there are any, then 5 digits.
create or replace function public.pick_free_tag() returns int
language plpgsql security definer set search_path = public as $$
declare
  candidate int;
begin
  for i in 1..40 loop
    candidate := 1000 + floor(random() * 9000)::int;
    if not exists (select 1 from public.profiles where tag = candidate) then return candidate; end if;
  end loop;
  -- The 4-digit range is crowded: look for a free number directly.
  select n into candidate from generate_series(1000, 9999) n where not exists (select 1 from public.profiles p where p.tag = n) order by random() limit 1;
  if candidate is not null then return candidate; end if;
  -- All 4-digit numbers are taken: 5 digits.
  for i in 1..200 loop
    candidate := 10000 + floor(random() * 90000)::int;
    if not exists (select 1 from public.profiles where tag = candidate) then return candidate; end if;
  end loop;
  raise exception 'no free player tag';
end;
$$;

-- Creates the caller's profile on first use (with the given trainer name) and returns it; with a name it also renames an existing profile.
create or replace function public.ensure_profile(p_display_name text default null) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_display_name, '')), 10);
  prof public.profiles;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into prof from public.profiles where user_id = uid;
  if found then
    if clean <> '' and prof.display_name <> clean then
      update public.profiles set display_name = clean where user_id = uid returning * into prof;
    end if;
    return prof;
  end if;
  if clean = '' then clean := 'Tränare'; end if;
  for i in 1..10 loop
    begin
      insert into public.profiles (user_id, display_name, tag) values (uid, clean, public.pick_free_tag()) returning * into prof;
      return prof;
    exception when unique_violation then
      -- Somebody took the tag a moment ago (or this call raced with another one of the same user): look again.
      select * into prof from public.profiles where user_id = uid;
      if found then return prof; end if;
    end;
  end loop;
  raise exception 'could not create a profile';
end;
$$;

revoke all on function public.pick_free_tag() from public, anon, authenticated;
revoke all on function public.ensure_profile(text) from public, anon;
grant execute on function public.ensure_profile(text) to authenticated;
