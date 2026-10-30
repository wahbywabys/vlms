-- Private space: each student's own study locker (saved parts, lessons and
-- results, notes, photos, flashcard schedule, practice history, goals).
--
-- One JSON document per learner, written whole by the app with an optimistic
-- revision (rev) so two devices never overwrite each other silently. Only the
-- learner reads or writes it: there is no staff route, and nothing in it feeds
-- competency levels, analytics or the early-warning model.
SET search_path = vtc, public;

CREATE TABLE IF NOT EXISTS private_spaces (
  learner_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state       jsonb NOT NULL DEFAULT '{"v":1,"items":[],"cards":{},"history":[],"goals":[],"activity":{}}'::jsonb,
  rev         integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_spaces_size CHECK (pg_column_size(state) <= 8 * 1024 * 1024)
);

COMMENT ON TABLE private_spaces IS 'A student''s Private space. Learner-only; never read by staff screens or analytics.';
