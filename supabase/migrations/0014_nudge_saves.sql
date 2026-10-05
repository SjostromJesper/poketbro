-- Nudge (Pokémon prototype): cloud saves, three slots per player. Only adds new objects; no existing table is touched.
-- Run this in the Supabase SQL Editor (or `supabase db push` once the CLI is linked to the project).
-- Also needed in the dashboard: Authentication -> Sign In / Providers -> enable "Allow anonymous sign-ins".

create table if not exists public.save_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  save_version int not null,
  data jsonb not null,
  summary jsonb not null,        -- for the load menu: player name, badges, play time, place, party icons
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

alter table public.save_slots enable row level security;

create policy "own saves select" on public.save_slots for select using (auth.uid() = user_id);
create policy "own saves insert" on public.save_slots for insert with check (auth.uid() = user_id);
create policy "own saves update" on public.save_slots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saves delete" on public.save_slots for delete using (auth.uid() = user_id);

-- updated_at is set by the server on every change, so the clients never depend on their own clocks.
create or replace function public.save_slots_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists save_slots_touch on public.save_slots;
create trigger save_slots_touch before insert or update on public.save_slots
  for each row execute function public.save_slots_touch();
