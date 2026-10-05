-- Party-based adventure exploration: a shared sparse world, per-character discovery,
-- and a bestående "time" resource that regenerates exactly like HP.

alter table public.characters
  add column time_remaining integer not null default 125,
  add column last_time_regen_at bigint not null default (extract(epoch from now()) * 1000)::bigint;

-- Sparse world content - only tiles with something actually on them exist here.
-- Terrain for every other coordinate is computed deterministically in code
-- (shared/game/worldmap.ts), never stored - the map is "free" precisely because
-- almost all of it is never written to a row.
create table public.world_pois (
  id uuid primary key default gen_random_uuid(),
  x integer not null,
  y integer not null,
  poi_type text not null check (poi_type in ('cave', 'ruin', 'town', 'village', 'capital')),
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (x, y)
);

alter table public.world_pois enable row level security;

create policy "world_pois_select_all" on public.world_pois
  for select using (auth.role() = 'authenticated');

insert into public.world_pois (x, y, poi_type, name, data)
values (0, 0, 'capital', 'Stenhem', '{}'::jsonb);

-- A character's own map - only rows for tiles they've actually stood on. This IS
-- the "you have to feel your way and map it out yourself" mechanic: there is no
-- table anywhere holding "the whole map", just each character's own footprints.
create table public.character_discovered_tiles (
  character_id uuid not null references public.characters (id) on delete cascade,
  x integer not null,
  y integer not null,
  terrain text not null,
  poi_type text null,
  discovered_at timestamptz not null default now(),
  primary key (character_id, x, y)
);

alter table public.character_discovered_tiles enable row level security;

create policy "discovered_tiles_select_own" on public.character_discovered_tiles
  for select using (
    exists (
      select 1 from public.characters c
      where c.id = character_discovered_tiles.character_id and c.user_id = auth.uid()
    )
  );

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  leader_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'forming' check (status in ('forming', 'traveling', 'in_event', 'disbanded')),
  x integer not null default 0,
  y integer not null default 0,
  pending_event jsonb null,
  created_at timestamptz not null default now()
);

alter table public.parties enable row level security;

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

alter table public.party_members enable row level security;

-- "Am I in this party" isn't a plain auth.uid() column check on `parties` itself,
-- so both tables are read via a dedicated server route (service role) rather than
-- direct client RLS reads - matches how the client never queries duel_queue
-- directly either. No select policies needed beyond enabling RLS (default deny).

-- Atomic party join, same shape as match_queue: lock a candidate row FOR UPDATE
-- SKIP LOCKED so two concurrent "join" calls can never both fill the same last
-- slot or spawn two parties when one open one already exists.
create or replace function public.join_or_create_party(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  out_party_id uuid,
  out_is_new boolean
) as $$
declare
  v_existing_party_id uuid;
  v_party_id uuid;
begin
  select pm.party_id into v_existing_party_id
  from public.party_members pm
  join public.parties p on p.id = pm.party_id
  where pm.user_id = p_user_id and p.status <> 'disbanded';

  if v_existing_party_id is not null then
    return query select v_existing_party_id, false;
    return;
  end if;

  select p.id into v_party_id
  from public.parties p
  where p.status = 'forming'
    and (select count(*) from public.party_members pm where pm.party_id = p.id) < 4
  order by p.created_at asc
  limit 1
  for update of p skip locked;

  if v_party_id is null then
    insert into public.parties (leader_user_id, status, x, y)
    values (p_user_id, 'forming', 0, 0)
    returning id into v_party_id;

    insert into public.party_members (party_id, user_id, character_id)
    values (v_party_id, p_user_id, p_character_id);

    return query select v_party_id, true;
    return;
  end if;

  insert into public.party_members (party_id, user_id, character_id)
  values (v_party_id, p_user_id, p_character_id);

  return query select v_party_id, false;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.join_or_create_party(uuid, uuid) from public;
grant execute on function public.join_or_create_party(uuid, uuid) to service_role;
