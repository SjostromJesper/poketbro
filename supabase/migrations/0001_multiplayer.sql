-- Multiplayer: shared characters, match history, and PvP queue/challenges.

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  race_id text not null,
  allocated jsonb not null,
  level int not null default 1 check (level between 1 and 4),
  xp int not null default 0 check (xp >= 0),
  current_hp int not null check (current_hp >= 0),
  last_regen_at bigint not null,
  default_tactic_id text not null default 'normal',
  default_give_up_percent int not null default 20 check (default_give_up_percent between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy "characters_select_all" on public.characters
  for select using (auth.role() = 'authenticated');
create policy "characters_insert_own" on public.characters
  for insert with check (auth.uid() = user_id);
create policy "characters_update_own" on public.characters
  for update using (auth.uid() = user_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('training', 'challenge', 'queue')),
  player_a_user_id uuid not null references auth.users (id) on delete cascade,
  player_a_name text not null,
  player_b_user_id uuid references auth.users (id) on delete cascade,
  player_b_name text not null,
  winner_name text not null,
  loser_name text not null,
  reason text not null,
  rounds int not null,
  log jsonb not null,
  created_at timestamptz not null default now(),
  acknowledged_a boolean not null default true,
  acknowledged_b boolean not null default false
);

alter table public.matches enable row level security;

create policy "matches_select_own" on public.matches
  for select using (auth.uid() = player_a_user_id or auth.uid() = player_b_user_id);

create table public.duel_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  level int not null,
  tactic_id text not null,
  give_up_percent int not null,
  joined_at timestamptz not null default now()
);

alter table public.duel_queue enable row level security;

create policy "duel_queue_select_own" on public.duel_queue
  for select using (auth.uid() = user_id);

-- Atomic matchmaking: finds the oldest queued opponent within level +/-1, using
-- FOR UPDATE SKIP LOCKED so two concurrent polls can never pair the same opponent
-- twice. If no opponent is found, upserts the caller into the queue instead.
create or replace function public.match_queue(
  p_user_id uuid,
  p_character_id uuid,
  p_level int,
  p_tactic_id text,
  p_give_up int
)
returns table (
  opponent_user_id uuid,
  opponent_character_id uuid,
  opponent_name text,
  opponent_level int,
  opponent_tactic_id text,
  opponent_give_up int
) as $$
declare
  v_user_id uuid;
  v_character_id uuid;
  v_level int;
  v_tactic_id text;
  v_give_up int;
  v_name text;
begin
  select dq.user_id, dq.character_id, dq.level, dq.tactic_id, dq.give_up_percent, c.name
    into v_user_id, v_character_id, v_level, v_tactic_id, v_give_up, v_name
  from public.duel_queue dq
  join public.characters c on c.id = dq.character_id
  where dq.user_id <> p_user_id
    and dq.level between p_level - 1 and p_level + 1
  order by dq.joined_at asc
  limit 1
  for update of dq skip locked;

  if v_user_id is null then
    insert into public.duel_queue (user_id, character_id, level, tactic_id, give_up_percent, joined_at)
    values (p_user_id, p_character_id, p_level, p_tactic_id, p_give_up, now())
    on conflict (user_id) do update set
      character_id = excluded.character_id,
      level = excluded.level,
      tactic_id = excluded.tactic_id,
      give_up_percent = excluded.give_up_percent,
      joined_at = excluded.joined_at;
    return;
  end if;

  delete from public.duel_queue where user_id = v_user_id;
  delete from public.duel_queue where user_id = p_user_id;

  return query select v_user_id, v_character_id, v_name, v_level, v_tactic_id, v_give_up;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.match_queue(uuid, uuid, int, text, int) from public;
grant execute on function public.match_queue(uuid, uuid, int, text, int) to service_role;
