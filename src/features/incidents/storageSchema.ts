// Additive schema in the existing keyed connection. Entry/HU37 tables remain untouched.
export const INCIDENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS incident_events (
  event_id TEXT PRIMARY KEY, package_id TEXT NOT NULL REFERENCES packages(id), exam_id TEXT NOT NULL,
  actor_binding TEXT NOT NULL, event_json TEXT NOT NULL, request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident_delivery (
  event_id TEXT PRIMARY KEY REFERENCES incident_events(event_id), state TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0, error_code TEXT
);
CREATE TABLE IF NOT EXISTS incident_receipts (
  event_id TEXT PRIMARY KEY REFERENCES incident_events(event_id), payload TEXT NOT NULL, request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident_lease (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT);
INSERT OR IGNORE INTO incident_lease(id,owner) VALUES(1,NULL);
CREATE TABLE IF NOT EXISTS discipline_owner_grants (
  package_id TEXT PRIMARY KEY REFERENCES packages(id), actor_binding TEXT NOT NULL, manifest_hash TEXT NOT NULL,
  allowed INTEGER NOT NULL, observed_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS infraction_drafts (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL REFERENCES packages(id), actor_binding TEXT NOT NULL,
  payload TEXT NOT NULL, request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS infraction_draft_submission (
  draft_id TEXT PRIMARY KEY REFERENCES infraction_drafts(id), state TEXT NOT NULL DEFAULT 'DRAFT', official_id INTEGER
);
CREATE TRIGGER IF NOT EXISTS immutable_incident_update BEFORE UPDATE ON incident_events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INCIDENT'); END;
CREATE TRIGGER IF NOT EXISTS immutable_incident_delete BEFORE DELETE ON incident_events BEGIN SELECT RAISE(ABORT,'KEEP_INCIDENT'); END;
CREATE TRIGGER IF NOT EXISTS immutable_incident_receipt_update BEFORE UPDATE ON incident_receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INCIDENT_RECEIPT'); END;
CREATE TRIGGER IF NOT EXISTS immutable_incident_receipt_delete BEFORE DELETE ON incident_receipts BEGIN SELECT RAISE(ABORT,'KEEP_INCIDENT_RECEIPT'); END;
CREATE TRIGGER IF NOT EXISTS keep_incident_delivery BEFORE DELETE ON incident_delivery BEGIN SELECT RAISE(ABORT,'KEEP_INCIDENT_DELIVERY'); END;
CREATE TRIGGER IF NOT EXISTS immutable_infraction_draft_update BEFORE UPDATE ON infraction_drafts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DRAFT'); END;
CREATE TRIGGER IF NOT EXISTS immutable_infraction_draft_delete BEFORE DELETE ON infraction_drafts BEGIN SELECT RAISE(ABORT,'KEEP_DRAFT'); END;
`
