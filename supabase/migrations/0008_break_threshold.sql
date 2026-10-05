-- Durability ("brytvärde") and skill-effectiveness are two separate stats, not one
-- dual-purposed number - recommended_skill keeps governing effective use, this new
-- column is purely how much damage the item can take before it breaks.
alter table public.items add column break_threshold integer null;

-- Backfill existing items with a reasonable durability so old gear doesn't become
-- instantly-breakable or unbreakable: derive from their current recommended_skill.
update public.items
set break_threshold = greatest(10, round(recommended_skill * 1.6))
where recommended_skill is not null and break_threshold is null;
