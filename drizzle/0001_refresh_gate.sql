CREATE TABLE IF NOT EXISTS refresh_gate (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_attempt INTEGER NOT NULL
);
