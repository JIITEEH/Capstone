-- Completed theses become a read-only library that every signed-in user can browse and search.
-- in_archive lets an admin keep a thesis out of it, for example one written with an industry partner
-- under a confidentiality agreement. Existing theses are included, like new ones.
ALTER TABLE theses ADD COLUMN in_archive INTEGER NOT NULL DEFAULT 1 CHECK (in_archive IN (0, 1));
