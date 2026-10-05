-- Nudge (PLAN-4 2.10): online matches. Only adds new objects; no existing table is touched.
-- Run this in the Supabase SQL Editor (or `supabase db push` once the CLI is linked to the project), after 0015_nudge_profiles.sql.
--
-- Nothing here is written from the browser: matches, ratings, current teams and challenges are only changed by the Edge Functions
-- (submit-bracket, send-challenge, respond-challenge), which validate the teams and simulate the battles on the server with the service role key.

create table if not exists public.bracket_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  bracket text not null,                  -- '1-9', '10-19' ... '90-99', '100'
  rating int not null default 1000,
  games int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bracket)
);

create table if not exists public.bracket_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  bracket text not null,
  team jsonb not null,                    -- the validated snapshot of the 3 Pokémon
  submitted_at timestamptz not null default now(),
  primary key (user_id, bracket)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bracket', 'challenge')),
  bracket text not null,                  -- also 'free' for challenges
  player_a uuid not null references auth.users(id) on delete cascade,   -- the one who sent the team in / the challenger
  player_b uuid not null references auth.users(id) on delete cascade,
  team_a jsonb not null,
  team_b jsonb not null,
  seed bigint not null,
  engine_version text not null,
  result text not null check (result in ('a', 'b', 'draw')),
  rating_change_a int,
  rating_change_b int,
  events jsonb,                           -- the event log (typically 5-15 kB; fits inline, see DECISIONS.md)
  events_path text,                       -- reserved for logs that are too big for the row (Storage)
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  bracket text not null,
  team_from jsonb not null,
  status text not null check (status in ('pending', 'accepted', 'declined', 'expired')),
  match_id uuid references public.matches(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists bracket_ratings_ladder on public.bracket_ratings (bracket, rating desc);
create index if not exists matches_player_a on public.matches (player_a, created_at desc);
create index if not exists matches_player_b on public.matches (player_b, created_at desc);
create index if not exists challenges_inbox on public.challenges (to_user, status);
create index if not exists challenges_outbox on public.challenges (from_user, status);

alter table public.bracket_ratings enable row level security;
alter table public.bracket_entries enable row level security;
alter table public.matches enable row level security;
alter table public.challenges enable row level security;

-- Ratings are public to everybody who is signed in (the ladders). A player sees their own current teams. Matches and challenges are read by the two players.
create policy "ratings readable" on public.bracket_ratings for select to authenticated using (true);
create policy "own entries" on public.bracket_entries for select to authenticated using (auth.uid() = user_id);
create policy "own matches" on public.matches for select to authenticated using (auth.uid() = player_a or auth.uid() = player_b);
create policy "own challenges" on public.challenges for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);

-- No writes from the browser at all.
revoke insert, update, delete on public.bracket_ratings, public.bracket_entries, public.matches, public.challenges from anon, authenticated;

-- Saves a match and everything that follows from it in one transaction: the match row, the ratings of both players (bracket matches) and the
-- challenge that was accepted. `p_rating_a` / `p_rating_b` are the new ratings (null = no rating change, as for challenges).
create or replace function public.nudge_record_match(
  p_kind text, p_bracket text, p_player_a uuid, p_player_b uuid, p_team_a jsonb, p_team_b jsonb, p_seed bigint, p_engine_version text,
  p_result text, p_events jsonb, p_rating_a int default null, p_rating_b int default null, p_challenge_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_match_id uuid;
  old_a int;
  old_b int;
begin
  if p_kind = 'bracket' then
    select coalesce((select rating from public.bracket_ratings where user_id = p_player_a and bracket = p_bracket), 1000) into old_a;
    select coalesce((select rating from public.bracket_ratings where user_id = p_player_b and bracket = p_bracket), 1000) into old_b;
  end if;

  insert into public.matches (kind, bracket, player_a, player_b, team_a, team_b, seed, engine_version, result, events, rating_change_a, rating_change_b)
  values (p_kind, p_bracket, p_player_a, p_player_b, p_team_a, p_team_b, p_seed, p_engine_version, p_result, p_events,
          case when p_rating_a is not null then p_rating_a - old_a end, case when p_rating_b is not null then p_rating_b - old_b end)
  returning id into v_match_id;

  if p_kind = 'bracket' then
    insert into public.bracket_ratings (user_id, bracket, rating, games, wins, losses, draws)
    values (p_player_a, p_bracket, coalesce(p_rating_a, old_a), 1, (p_result = 'a')::int, (p_result = 'b')::int, (p_result = 'draw')::int)
    on conflict (user_id, bracket) do update set
      rating = coalesce(p_rating_a, public.bracket_ratings.rating), games = public.bracket_ratings.games + 1,
      wins = public.bracket_ratings.wins + (p_result = 'a')::int, losses = public.bracket_ratings.losses + (p_result = 'b')::int,
      draws = public.bracket_ratings.draws + (p_result = 'draw')::int, updated_at = now();
    insert into public.bracket_ratings (user_id, bracket, rating, games, wins, losses, draws)
    values (p_player_b, p_bracket, coalesce(p_rating_b, old_b), 1, (p_result = 'b')::int, (p_result = 'a')::int, (p_result = 'draw')::int)
    on conflict (user_id, bracket) do update set
      rating = coalesce(p_rating_b, public.bracket_ratings.rating), games = public.bracket_ratings.games + 1,
      wins = public.bracket_ratings.wins + (p_result = 'b')::int, losses = public.bracket_ratings.losses + (p_result = 'a')::int,
      draws = public.bracket_ratings.draws + (p_result = 'draw')::int, updated_at = now();
  end if;

  if p_challenge_id is not null then
    update public.challenges set status = 'accepted', match_id = v_match_id where id = p_challenge_id and status = 'pending';
  end if;
  return v_match_id;
end;
$$;

revoke all on function public.nudge_record_match(text, text, uuid, uuid, jsonb, jsonb, bigint, text, text, jsonb, int, int, uuid) from public, anon, authenticated;
grant execute on function public.nudge_record_match(text, text, uuid, uuid, jsonb, jsonb, bigint, text, text, jsonb, int, int, uuid) to service_role;
