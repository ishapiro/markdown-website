-- Drop tables if they exist (for re-running migrations)
DROP TABLE IF EXISTS notes_search;
DROP TABLE IF EXISTS note_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS notes;

-- Main notes metadata table
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- e.g. 'coding/nuxt-setup'
  parent_path TEXT NOT NULL DEFAULT '/', -- For the sidebar tree
  content_preview TEXT DEFAULT '',    -- First ~200 chars for search results
  r2_key TEXT NOT NULL,               -- The R2 blob key for full content
  is_published BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_slug ON notes(slug);
CREATE INDEX idx_notes_parent_path ON notes(parent_path);
CREATE INDEX idx_notes_published ON notes(is_published);

-- Tags table
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

-- Note <-> Tag join table
CREATE TABLE note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE notes_search USING fts5(
  title,
  content_preview,
  slug UNINDEXED,
  content='notes',
  content_rowid='id'
);

-- Keep FTS in sync via triggers
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;

CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
END;

CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;
