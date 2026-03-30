/**
 * Direct migration script — no running dev server required.
 *
 * What it does:
 * 1. Copies Markdown files into .data/hub/blob/ (NuxtHub local blob store)
 * 2. Copies images into .data/hub/blob/
 * 3. Rewrites Obsidian ![[image]] refs to /api/images/<key>
 * 4. Applies the schema + inserts metadata into .data/db.sqlite3 (Nitro/better-sqlite3)
 *
 * Usage (dev server does NOT need to be running):
 *   VAULT_DIR="./vault2/Cogitations Website" node migrate-direct.mjs
 */

import fs from 'fs'
import path from 'path'
import { globby } from 'globby'
import Database from 'better-sqlite3'

const VAULT_DIR = process.env.VAULT_DIR || './vault2/Cogitations Website'
const BLOB_DIR = '.data/blob'
const DB_PATH = '.data/db.sqlite3'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])

// ── Slug helpers ──────────────────────────────────────────────────────────────

function toSlug(filePath, vaultDir) {
  return path.relative(vaultDir, filePath)
    .replace(/\.md$/, '')
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/[^a-z0-9\/\-\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\/-/g, '/')
    .replace(/-\//g, '/')
    .slice(0, 200)
}

function toParentPath(filePath, vaultDir) {
  const dir = path.dirname(path.relative(vaultDir, filePath))
  if (dir === '.') return '/'
  return '/' + dir.replace(/\\/g, '/').toLowerCase()
    .replace(/[^a-z0-9\/\-\s]/g, ' ').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-')
}

function extractTitle(filename) {
  // Use the original filename (already properly cased) as the title
  return filename
}

// ── Image ref rewriting ───────────────────────────────────────────────────────

function buildImageMap(imageFiles) {
  const map = new Map()
  for (const imgFile of imageFiles) {
    const basename = path.basename(imgFile)
    const key = `images/${basename}`
    map.set(basename.toLowerCase(), key)
    map.set(basename, key)
  }
  return map
}

function encodeImageKey(key) {
  // Encode each path segment separately to preserve slashes
  return key.split('/').map(s => encodeURIComponent(s)).join('/')
}

function rewriteImageRefs(content, imageMap) {
  // Obsidian embed: ![[filename.ext]] or ![[filename.ext|width]]
  content = content.replace(/!\[\[([^\]|]+?)(?:\|[^\]]*?)?\]\]/g, (match, filename) => {
    const basename = path.basename(filename.trim())
    const key = imageMap.get(basename) || imageMap.get(basename.toLowerCase())
    if (key) return `![${basename}](/api/images/${encodeImageKey(key)})`
    return match
  })
  // Standard markdown images
  content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const basename = path.basename(src.trim())
    if (!IMAGE_EXTS.has(path.extname(basename).toLowerCase())) return match
    const key = imageMap.get(basename) || imageMap.get(basename.toLowerCase())
    if (key) return `![${alt}](/api/images/${encodeImageKey(key)})`
    return match
  })
  return content
}

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_path TEXT NOT NULL DEFAULT '/',
  content_preview TEXT DEFAULT '',
  r2_key TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_slug ON notes(slug);
CREATE INDEX IF NOT EXISTS idx_notes_parent_path ON notes(parent_path);
CREATE INDEX IF NOT EXISTS idx_notes_published ON notes(is_published);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_search USING fts5(
  title,
  content_preview,
  slug UNINDEXED,
  content='notes',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_search(notes_search, rowid, title, content_preview, slug)
  VALUES ('delete', old.id, old.title, old.content_preview, old.slug);
  INSERT INTO notes_search(rowid, title, content_preview, slug)
  VALUES (new.id, new.title, new.content_preview, new.slug);
END;
`

// ── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  if (!fs.existsSync(VAULT_DIR)) {
    console.error(`Vault directory not found: ${VAULT_DIR}`)
    process.exit(1)
  }

  fs.mkdirSync(BLOB_DIR, { recursive: true })
  fs.mkdirSync(path.join(BLOB_DIR, 'notes'), { recursive: true })
  fs.mkdirSync(path.join(BLOB_DIR, 'images'), { recursive: true })
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  // ── 1. Open SQLite and apply schema ────────────────────────────────────────
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  console.log(`\nApplying schema to ${DB_PATH}...`)
  db.exec(SCHEMA)
  console.log('  ✓ Schema ready\n')

  // ── 2. Copy images ─────────────────────────────────────────────────────────
  const imageFiles = await globby(`${VAULT_DIR}/**/*.{jpg,jpeg,png,gif,webp,svg}`)
  console.log(`Found ${imageFiles.length} images`)
  const imageMap = buildImageMap(imageFiles)

  for (const imgFile of imageFiles) {
    const basename = path.basename(imgFile)
    fs.copyFileSync(imgFile, path.join(BLOB_DIR, 'images', basename))
    console.log(`  🖼  ${basename}`)
  }

  // ── 3. Migrate markdown files ───────────────────────────────────────────────
  const mdFiles = await globby(`${VAULT_DIR}/**/*.md`)
  console.log(`\nFound ${mdFiles.length} Markdown files`)

  const insert = db.prepare(`
    INSERT OR REPLACE INTO notes (title, slug, parent_path, content_preview, r2_key, is_published)
    VALUES (@title, @slug, @parent_path, @content_preview, @r2_key, @is_published)
  `)

  const insertMany = db.transaction((notes) => {
    for (const note of notes) insert.run(note)
  })

  const notesData = []

  for (const file of mdFiles) {
    let content = fs.readFileSync(file, 'utf-8')
    const filename = path.basename(file, '.md')
    const slug = toSlug(file, VAULT_DIR)
    const parentPath = toParentPath(file, VAULT_DIR)
    const r2Key = `notes/${slug}.md`

    content = rewriteImageRefs(content, imageMap)

    const title = extractTitle(filename)
    const contentPreview = content
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/#+\s/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 200)

    // Write to blob filesystem
    const blobPath = path.join(BLOB_DIR, r2Key)
    fs.mkdirSync(path.dirname(blobPath), { recursive: true })
    fs.writeFileSync(blobPath, content, 'utf-8')
    console.log(`  📄 ${slug}`)

    notesData.push({ title, slug, parent_path: parentPath, content_preview: contentPreview, r2_key: r2Key, is_published: 1 })
  }

  insertMany(notesData)
  db.close()

  console.log(`\n✓ Migrated ${mdFiles.length} notes and ${imageFiles.length} images to ${DB_PATH}`)
}

migrate()
