alter table public.items
  add column absorption integer null;

-- Shields always have two defensive actions per round (confirmed by a real shield's stat sheet).
update public.items set max_blocks_per_round = 2 where slot = 'shield';
