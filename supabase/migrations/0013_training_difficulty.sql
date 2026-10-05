-- Gladiatorskolan difficulty ladder, matching real Lanista: each win in the training
-- school advances you to a harder opponent (more XP too); each loss demotes you back
-- one step. Capped at 5, per the request - always winnable, but a real test at the top.
alter table public.characters
  add column training_difficulty integer not null default 1 check (training_difficulty between 1 and 5);
