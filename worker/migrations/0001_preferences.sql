CREATE TABLE preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  preferences TEXT NOT NULL CHECK (json_valid(preferences)),
  updated_at TEXT NOT NULL
);
