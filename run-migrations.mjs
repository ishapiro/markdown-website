/**
 * Idempotent local migration runner.
 * Uses better-sqlite3 against the wrangler local D1 SQLite file.
 *
 * - Auto-discovers all drizzle/*.sql files (sorted)
 * - Tracks applied migrations in a _migrations table
 * - For bootstrap (DB exists but no _migrations table yet): falls back to
 *   PRAGMA checks to detect already-applied statements, then records them
 * - Backs up the database before applying any new migrations
 *
 * Usage: node run-migrations.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const MIGRATIONS_DIR = 'drizzle'
const BACKUP_DIR = './db-backups'

async function findDbFile() {
  const files = await globby('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite', {
    ignore: ['**/*.sqlite-shm', '**/*.sqlite-wal'],
  })
  if (files.length === 0) return null
  if (files.length > 1) console.warn(`Warning: multiple D1 SQLite files found, using: ${files[0]}`)
  return files[0]
}

function backupDb(dbPath) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = path.join(BACKUP_DIR, `cogitations-${ts}.sqlite`)
  fs.copyFileSync(dbPath, dest)
  for (const ext of ['-wal', '-shm']) {
    const src = dbPath + ext
    if (fs.existsSync(src)) fs.copyFileSync(src, dest + ext)
  }
  console.log(`Backup:   ${dest}`)
  return dest
}

function ensureMigrationsTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
}

function getApplied(db) {
  return new Set(db.prepare('SELECT name FROM _migrations').all().map(r => r.name))
}

function recordMigration(db, name) {
  db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').run(name)
}

// --- Idempotency helpers (fallback for bootstrap) ---

function hasTable(db, table) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
}

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(\`${table}\`)`).all().some(c => c.name === column)
}

function statementAlreadyApplied(db, stmt) {
  const up = stmt.replace(/\s+/g, ' ').trim().toUpperCase()
  if (up.startsWith('CREATE TABLE')) {
    const m = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)
    if (m) return hasTable(db, m[1])
  }
  if (up.startsWith('ALTER TABLE') && up.includes('ADD COLUMN')) {
    const tm = stmt.match(/ALTER\s+TABLE\s+`?(\w+)`?/i)
    const cm = stmt.match(/ADD\s+COLUMN\s+`?(\w+)`?/i)
    if (tm && cm) return hasColumn(db, tm[1], cm[1])
  }
  return false
}

function applyStatement(db, stmt) {
  if (statementAlreadyApplied(db, stmt)) {
    console.log(`  ↷  Already applied — skipped`)
    return
  }
  try {
    db.exec(stmt)
    console.log(`  ✓  ${stmt.replace(/\s+/g, ' ').trim().slice(0, 80)}`)
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('duplicate column')) {
      console.log(`  ↷  Already applied — skipped (${e.message})`)
    } else {
      console.error(`  ✗  ERROR: ${e.message}`)
      throw e
    }
  }
}

function parseMigration(file) {
  return fs.readFileSync(file, 'utf-8')
    .split(/--> statement-breakpoint|\n;/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
}

async function run() {
  const dbPath = await findDbFile()
  if (!dbPath) {
    console.error('No local D1 database found. Run `npx wrangler dev` once to initialise it, then retry.')
    process.exit(1)
  }
  console.log(`Database: ${dbPath}\n`)

  const db = new Database(dbPath)
  ensureMigrationsTable(db)
  const applied = getApplied(db)

  // Auto-discover all migration files
  const files = (await globby(`${MIGRATIONS_DIR}/*.sql`)).sort()
  const pending = files.filter(f => !applied.has(path.basename(f)))

  if (pending.length === 0) {
    console.log('All migrations already applied — nothing to do.')
    if (applied.size > 0) console.log(`Applied: ${[...applied].join(', ')}`)
    db.close()
    return
  }

  console.log(`Applied:  ${applied.size > 0 ? [...applied].join(', ') : 'none'}`)
  console.log(`Pending:  ${pending.map(f => path.basename(f)).join(', ')}\n`)

  backupDb(dbPath)
  console.log()

  for (const file of pending) {
    const name = path.basename(file)
    console.log(`Applying: ${name}`)
    const stmts = parseMigration(file)
    try {
      for (const stmt of stmts) applyStatement(db, stmt)
      recordMigration(db, name)
      console.log()
    } catch (e) {
      console.error(`\nFailed on ${name} — stopping.`)
      db.close()
      process.exit(1)
    }
  }

  db.close()
  console.log('Migrations complete.')
}

run().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
