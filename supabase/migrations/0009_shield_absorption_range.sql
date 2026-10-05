-- Two real battle reports (same shield, same match) showed absorbed damage varying
-- between hits (4 on one block, 2 on three others) - shield absorption is a rolled
-- min-max range like weapon damage, not the single flat number we assumed before.
-- `absorption` keeps meaning the max of that range; this adds the floor.
alter table public.items add column min_absorption integer null;

update public.items
set min_absorption = greatest(1, round(absorption * 0.3))
where absorption is not null and min_absorption is null;
