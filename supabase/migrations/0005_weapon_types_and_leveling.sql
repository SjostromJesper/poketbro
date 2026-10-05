-- Weapon types, shields, and per-item combat properties
alter table public.items
  drop constraint items_slot_check,
  add constraint items_slot_check check (slot in ('weapon', 'shield', 'helmet', 'chest', 'legs', 'boots', 'amulet')),
  add column weapon_type text null check (weapon_type in ('sword', 'axe', 'thrust', 'hammer', 'chain')),
  add column extra_attack_chance numeric not null default 0,
  add column max_blocks_per_round integer not null default 1;

-- Level-up stat points
alter table public.characters
  add column unspent_points integer not null default 0;
