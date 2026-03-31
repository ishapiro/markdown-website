/**
 * Idempotent local migration runner.
 * Uses better-sqlite3 directly against the wrangler local D1 SQLite file.
 *
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

// Find the wrangler local D1 SQLite file
async function findOrCreateDb() {
  const pattern = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite'
  let files = await globby(pattern)

  if (files.length === 0) {
    // DB doesn't exist yet — create the directory and an empty SQLite file
    const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
    fs.mkdirSync(dir, { recursive: true })
    const dbPath = path.join(dir, 'local.sqlite')
    // Opening with better-sqlite3 creates the file
    const db = new Database(dbPath)
    db.close()
    files = [dbPath]
    console.log(`Created new SQLite file: ${dbPath}`)
  }

  if (files.length > 1) {
    console.warn(`Warning: multiple D1 SQLite files found, using: ${files[0]}`)
  }

  return files[0]
}

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(\`${table}\`)`).all()
  return cols.some((c) => c.name === column)
}

function applyStatement(db, stmt, migFile) {
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
    // Print just the first 80 chars for readability
    console.log(`  ✓  ${stmt.replace(/\s+/g, ' ').trim().slice(0, 80)}`)
  } catch (e) {
    // Treat "already exists" errors as warnings, not failures
    if (e.message.includes('already exists')) {
      console.log(`  ↷  Already exists — skipped (${e.message})`)
    } else {
      console.error(`  ✗  ERROR: ${e.message}`)
      console.error(`     Statement: ${stmt.trim().slice(0, 120)}`)
    }
  }
}

async function run() {
  const dbPath = await findOrCreateDb()
  console.log(`Database: ${dbPath}\n`)

  const db = new Database(dbPath)

  for (const migFile of MIGRATIONS) {
    if (!fs.existsSync(migFile)) {
      console.warn(`Migration file not found, skipping: ${migFile}`)
      continue
    }

    console.log(`Applying: ${migFile}`)
    const sql = fs.readFileSync(migFile, 'utf-8')

    // Split on Drizzle breakpoint markers; also handle plain semicolons
    const statements = sql
      .split(/--> statement-breakpoint|\n;/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const stmt of statements) {
      applyStatement(db, stmt, migFile)
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
