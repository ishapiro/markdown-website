CREATE VIRTUAL TABLE IF NOT EXISTS notes_search USING fts5(
  title,
  content_preview,
  slug UNINDEXED,
  content='notes',
  content_rowid='id'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;
--> statement-breakpoint
INSERT INTO notes_search(notes_search) VALUES('rebuild');
