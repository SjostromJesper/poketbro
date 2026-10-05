alter table public.characters
  add column skill_ids jsonb not null default '[null, null, null, null]'::jsonb
  constraint characters_skill_ids_length check (jsonb_array_length(skill_ids) = 4);
