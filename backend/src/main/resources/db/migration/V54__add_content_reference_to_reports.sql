-- "What I pass on" (2026-07-30): let a report say *which thing* it is about.
--
-- Reports have been user-to-user since V11 — reason, description, and the person complained
-- about. That cannot express the objection this feature creates: a living person named in
-- somebody else's story needs to point at the story, and "this person wrote something
-- upsetting somewhere" is not something an admin can act on.
--
-- Both columns are nullable and the old shape stays legal, because most reports are still
-- about a person and nothing more. They are only ever written as a pair — a type with
-- nothing it points at, or an id with nothing saying what it is, is a reference that cannot
-- be followed, so the check below refuses it rather than storing a dead pointer.
--
-- Deliberately NOT a foreign key. Reports are evidence and must outlive the thing complained
-- about; an ON DELETE CASCADE would erase the report the moment the elder took the story
-- down, which is exactly when the report matters most. ReportService verifies the target
-- exists, is readable by the reporter, and belongs to the person named, at the moment the
-- report is filed.
ALTER TABLE reports
  ADD COLUMN content_type VARCHAR(20),
  ADD COLUMN content_id UUID;

ALTER TABLE reports
  ADD CONSTRAINT ck_reports_content_type CHECK (content_type IS NULL OR content_type IN ('PASSON_ITEM')),
  ADD CONSTRAINT ck_reports_content_pair CHECK ((content_type IS NULL) = (content_id IS NULL));

-- "Has anybody complained about this story?" is the one question an admin asks of this table
-- that V11's two indexes cannot answer.
CREATE INDEX ix_reports_content ON reports(content_type, content_id) WHERE content_id IS NOT NULL;
