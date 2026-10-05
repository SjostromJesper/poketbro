-- Arena beast fights: a fixed named-monster list, unlocked once graduated (level 4).
alter table public.matches drop constraint matches_kind_check;
alter table public.matches add constraint matches_kind_check check (kind in ('training', 'challenge', 'queue', 'beast'));
