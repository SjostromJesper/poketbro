create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('weapon', 'helmet', 'chest', 'legs', 'boots', 'amulet')),
  name text not null,
  quality text not null check (quality in ('common', 'uncommon', 'rare')),
  stat_bonuses jsonb not null,
  equipped boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);

create unique index items_one_equipped_per_slot on public.items (user_id, slot) where equipped;
