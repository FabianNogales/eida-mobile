// Additive local schema v2. All tables live in the same verified SQLCipher database.
export const OUTBOX_SCHEMA = `
  CREATE TABLE IF NOT EXISTS sync_outbox (
    event_id TEXT PRIMARY KEY REFERENCES events(event_id), actor_binding TEXT NOT NULL,
    wire_context TEXT NOT NULL, wire_event TEXT NOT NULL, request_hash TEXT NOT NULL,
    needs_qr_v3 INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT, error_code TEXT, error_message TEXT, attempt_id TEXT
  );
  CREATE INDEX IF NOT EXISTS sync_outbox_state ON sync_outbox(state);
  CREATE TABLE IF NOT EXISTS sync_receipts (
    event_id TEXT PRIMARY KEY REFERENCES events(event_id), result TEXT NOT NULL,
    received_local_at TEXT NOT NULL, request_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_attempts (
    id TEXT PRIMARY KEY, actor_binding TEXT NOT NULL, exam_id TEXT NOT NULL,
    request_json TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT
  );
  CREATE TABLE IF NOT EXISTS sync_lease (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT);
  INSERT OR IGNORE INTO sync_lease(id,owner) VALUES(1,NULL);
  CREATE TRIGGER IF NOT EXISTS immutable_outbox_request BEFORE UPDATE OF
    actor_binding,wire_context,wire_event,request_hash,needs_qr_v3 ON sync_outbox
    BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_OUTBOX_REQUEST'); END;
  CREATE TRIGGER IF NOT EXISTS keep_outbox_delete BEFORE DELETE ON sync_outbox
    BEGIN SELECT RAISE(ABORT, 'KEEP_OUTBOX'); END;
  CREATE TRIGGER IF NOT EXISTS immutable_sync_receipt_update BEFORE UPDATE ON sync_receipts
    BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_RECEIPT'); END;
  CREATE TRIGGER IF NOT EXISTS immutable_sync_receipt_delete BEFORE DELETE ON sync_receipts
    BEGIN SELECT RAISE(ABORT, 'KEEP_RECEIPT'); END;
  CREATE TRIGGER IF NOT EXISTS immutable_sync_attempt_request BEFORE UPDATE OF
    actor_binding,exam_id,request_json,started_at ON sync_attempts
    BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_SYNC_ATTEMPT'); END;
`
