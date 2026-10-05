alter table public.characters
  add column gold integer not null default 50;

create table public.shop_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null,
  name text not null,
  quality text not null,
  enchant_level integer not null default 0,
  stat_bonuses jsonb not null,
  weapon_type text null,
  extra_attack_chance numeric not null default 0,
  max_blocks_per_round integer not null default 1,
  min_damage integer null,
  max_damage integer null,
  recommended_skill integer null,
  price integer not null,
  created_at timestamptz not null default now()
);

alter table public.shop_offers enable row level security;

create policy "shop_offers_select_own" on public.shop_offers
  for select using (auth.uid() = user_id);
