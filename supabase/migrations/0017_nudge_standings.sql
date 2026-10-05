-- Nudge (PLAN-4 2.9): the ladders. Only adds two read-only functions (run after 0016_nudge_matches.sql); no table is touched.
-- Placement is counted on the server over the whole bracket: the players with at least 3 matches are placed by rating (equal ratings share a place),
-- the others come after them and are shown as "Ej placerad". Ratings and profiles are readable for every signed-in player (row level security), so the functions run as the caller.

create or replace function public.nudge_standings(p_bracket text, p_limit int default 50, p_offset int default 0)
returns table (user_id uuid, display_name text, tag int, rating int, games int, wins int, losses int, draws int, rank bigint, "position" bigint)
language sql stable security invoker set search_path = public as $$
  with ladder as (
    select r.user_id, p.display_name, p.tag, r.rating, r.games, r.wins, r.losses, r.draws,
           case when r.games >= 3 then rank() over (partition by (r.games >= 3) order by r.rating desc) end as rank,
           row_number() over (order by (r.games >= 3) desc, r.rating desc, r.games desc, r.user_id) as "position"
    from public.bracket_ratings r
    join public.profiles p on p.user_id = r.user_id
    where r.bracket = p_bracket
  )
  select * from ladder order by "position" limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;

-- The caller's own row on the ladder (with the place and the position in the list, to jump to the right page) and how many players are on it.
create or replace function public.nudge_my_standing(p_bracket text)
returns table (user_id uuid, display_name text, tag int, rating int, games int, wins int, losses int, draws int, rank bigint, "position" bigint, total_players bigint, placed_players bigint)
language sql stable security invoker set search_path = public as $$
  with ladder as (
    select r.user_id, p.display_name, p.tag, r.rating, r.games, r.wins, r.losses, r.draws,
           case when r.games >= 3 then rank() over (partition by (r.games >= 3) order by r.rating desc) end as rank,
           row_number() over (order by (r.games >= 3) desc, r.rating desc, r.games desc, r.user_id) as "position"
    from public.bracket_ratings r
    join public.profiles p on p.user_id = r.user_id
    where r.bracket = p_bracket
  )
  select l.*, (select count(*) from ladder), (select count(*) from ladder where games >= 3)
  from ladder l where l.user_id = auth.uid();
$$;

revoke all on function public.nudge_standings(text, int, int) from public, anon;
revoke all on function public.nudge_my_standing(text) from public, anon;
grant execute on function public.nudge_standings(text, int, int) to authenticated;
grant execute on function public.nudge_my_standing(text) to authenticated;
