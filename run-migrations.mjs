/**
 * Idempotent local migration runner.
 * Uses better-sqlite3 directly against the wrangler local D1 SQLite file.
 *
 * - Backs up the database before applying any migrations
 * - CREATE TABLE  → uses IF NOT EXISTS (safe to re-run)
 * - ADD COLUMN    → checks PRAGMA table_info first, skips if column already exists
 * - Everything else → runs as-is, errors are reported but don't halt the script
 *
 * Usage: node run-migrations.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const MIGRATIONS = [
  'drizzle/0000_blushing_slapstick.sql',
  'drizzle/0001_add_sort_order.sql',
  'drizzle/0002_add_show_date.sql',
]

const BACKUP_DIR = './db-backups'

// Find the wrangler local D1 SQLite file (UUID-named by wrangler)
async function findDbFile() {
  const files = await globby('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite', {
    ignore: ['**/*.sqlite-shm', '**/*.sqlite-wal'],
  })
  if (files.length === 0) return null
  if (files.length > 1) {
    console.warn(`Warning: multiple D1 SQLite files found, using: ${files[0]}`)
  }
  return files[0]
}

function backupDb(dbPath) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = path.join(BACKUP_DIR, `cogitations-${ts}.sqlite`)
  fs.copyFileSync(dbPath, dest)
  // Copy WAL/SHM if they exist (ensures a consistent snapshot)
  for (const ext of ['-wal', '-shm']) {
    const src = dbPath + ext
    if (fs.existsSync(src)) fs.copyFileSync(src, dest + ext)
  }
  console.log(`Backup: ${dest}`)
  return dest
}

function hasTable(db, table) {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
  return !!row
}

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(\`${table}\`)`).all()
  return cols.some((c) => c.name === column)
}

// Returns true if the statement would actually change the database.
function statementNeeded(db, stmt) {
  const normalized = stmt.replace(/\s+/g, ' ').trim().toUpperCase()

  if (normalized.startsWith('CREATE TABLE')) {
    const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)
    if (match) return !hasTable(db, match[1])
  }

  if (normalized.startsWith('CREATE') && normalized.includes('INDEX')) {
    // Indexes are low-risk; treat as always needed (they use IF NOT EXISTS)
    return false
  }

  if (normalized.startsWith('ALTER TABLE') && normalized.includes('ADD COLUMN')) {
    const tableMatch = stmt.match(/ALTER\s+TABLE\s+`?(\w+)`?/i)
    const colMatch = stmt.match(/ADD\s+COLUMN\s+`?(\w+)`?/i)
    if (tableMatch && colMatch) {
      return !hasColumn(db, tableMatch[1], colMatch[1])
    }
  }

  // Unknown statement type — assume it needs to run
  return true
}

function applyStatement(db, stmt) {
  const normalized = stmt.replace(/\s+/g, ' ').trim().toUpperCase()

  // ALTER TABLE ... ADD COLUMN — check first via PRAGMA
  if (normalized.startsWith('ALTER TABLE') && normalized.includes('ADD COLUMN')) {
    const tableMatch = stmt.match(/ALTER\s+TABLE\s+`?(\w+)`?/i)
    const colMatch = stmt.match(/ADD\s+COLUMN\s+`?(\w+)`?/i)
    if (tableMatch && colMatch) {
      const table = tableMatch[1]
      const column = colMatch[1]
      if (hasColumn(db, table, column)) {
        console.log(`  ↷  ${table}.${column} already exists — skipped`)
        return
      }
    }
  }

  try {
    db.exec(stmt)
    console.log(`  ✓  ${stmt.replace(/\s+/g, ' ').trim().slice(0, 80)}`)
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log(`  ↷  Already exists — skipped (${e.message})`)
    } else {
      console.error(`  ✗  ERROR: ${e.message}`)
      console.error(`     Statement: ${stmt.trim().slice(0, 120)}`)
    }
  }
}

function parseMigration(migFile) {
  const sql = fs.readFileSync(migFile, 'utf-8')
  return sql
    .split(/--> statement-breakpoint|\n;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))
}

async function run() {
  const dbPath = await findDbFile()

  if (!dbPath) {
    console.error('No local D1 database found. Run "npx wrangler d1 execute cogitations-db --local --command=SELECT 1" once to initialise it, then retry.')
    process.exit(1)
  }

  console.log(`Database: ${dbPath}\n`)

  const db = new Database(dbPath)

  // Parse all migrations and check which statements actually need to run
  const pending = []
  for (const migFile of MIGRATIONS) {
    if (!fs.existsSync(migFile)) {
      console.warn(`Migration file not found, skipping: ${migFile}`)
      continue
    }
    const stmts = parseMigration(migFile)
    const needed = stmts.filter((s) => statementNeeded(db, s))
    if (needed.length > 0) pending.push({ migFile, stmts })
  }

  if (pending.length === 0) {
    console.log('All migrations already applied — nothing to do.')
    db.close()
    return
  }

  // Only backup if there is actual work to do
  backupDb(dbPath)
  console.log()

  for (const { migFile, stmts } of pending) {
    console.log(`Applying: ${migFile}`)
    for (const stmt of stmts) {
      applyStatement(db, stmt)
    }
    console.log()
  }

  db.close()
  console.log('Migrations complete.')
}

run().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
