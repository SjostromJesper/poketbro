-- Defense in depth: nothing stopped the same user_id from appearing in party_members
-- rows for two different parties (the PK is (party_id, user_id), not user_id alone).
-- Application logic (join_or_create_party) already checks for an existing active
-- membership before adding one, but a DB-level constraint is the real guarantee.
alter table public.party_members add constraint party_members_user_id_unique unique (user_id);
