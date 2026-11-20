CREATE TABLE source_snapshots (
  source TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  error_at TEXT,
  jobs TEXT NOT NULL
);
