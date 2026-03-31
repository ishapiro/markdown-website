/**
 * Idempotent remote D1 migration runner.
 * Uses wrangler CLI subprocess to execute SQL against the remote D1 database.
 *
 * - Auto-discovers all drizzle/*.sql files (sorted)
 * - Tracks applied migrations in a _migrations table on the remote DB
 * - Bootstrap-safe: if _migrations is empty, detects already-applied migrations
 *   via wrangler errors and records them without failing
 *
 * Usage: node run-remote-migrations.mjs
 */

import { spawnSync } from 'child_process'
import { globby } from 'globby'
import path from 'path'

const DB = 'cogitations-db'
const MIGRATIONS_DIR = 'drizzle'

// Run a SQL command on the remote DB and return parsed JSON results.
// Pipes 'yes' to auto-confirm the wrangler prompt.
function d1Query(sql) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', `--command=${sql}`, '--json'],
    { encoding: 'utf-8', input: 'yes\n', stdio: ['pipe', 'pipe', 'pipe'] },
  )

  const raw = (result.stdout || '').trim()
  // wrangler may print a banner before the JSON array — find the start
  const start = raw.indexOf('[')
  if (start === -1) {
    const err = result.stderr || raw
    throw new Error(`No JSON in wrangler output.\n${err.slice(0, 400)}`)
  }

  try {
    return JSON.parse(raw.slice(start))
  } catch {
    throw new Error(`Could not parse wrangler JSON.\n${raw.slice(0, 400)}`)
  }
}

// Execute a migration .sql file on the remote DB.
// Returns { ok, alreadyApplied } — does NOT throw on "already exists" errors.
function d1File(file) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', `--file=${file}`],
    { encoding: 'utf-8', input: 'yes\n', stdio: ['pipe', 'inherit', 'pipe'] },
  )

  if (result.status === 0) return { ok: true, alreadyApplied: false }

  const stderr = result.stderr || ''
  const alreadyApplied =
    stderr.includes('already exists') ||
    stderr.includes('duplicate column') ||
    stderr.includes('SQLITE_ERROR: duplicate') ||
    stderr.includes('table') && stderr.includes('already exists')

  return { ok: false, alreadyApplied, stderr }
}

async function run() {
  console.log('=== Remote D1 Migration Runner ===\n')

  // Ensure tracking table exists
  console.log('Checking _migrations table…')
  d1Query(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  )

  // Get already-applied migrations
  const rows = d1Query('SELECT name FROM _migrations ORDER BY name')
  const applied = new Set((rows[0]?.results ?? []).map(r => r.name))

  if (applied.size > 0) {
    console.log(`Applied:  ${[...applied].join(', ')}`)
  } else {
    console.log('Applied:  none recorded yet')
  }

  // Auto-discover migration files
  const files = (await globby(`${MIGRATIONS_DIR}/*.sql`)).sort()
  const pending = files.filter(f => !applied.has(path.basename(f)))

  if (pending.length === 0) {
    console.log('\nAll migrations already applied — nothing to do.')
    return
  }

  console.log(`\nPending ${pending.length} migration(s):`)
  for (const f of pending) console.log(`  · ${path.basename(f)}`)
  console.log()

  for (const file of pending) {
    const name = path.basename(file)
    process.stdout.write(`Applying: ${name} … `)

    const { ok, alreadyApplied, stderr } = d1File(file)

    if (ok) {
      d1Query(`INSERT OR IGNORE INTO _migrations (name) VALUES ('${name}')`)
      console.log('✓')
    } else if (alreadyApplied) {
      // Bootstrap case: migration was already on the DB before tracking was added
      d1Query(`INSERT OR IGNORE INTO _migrations (name) VALUES ('${name}')`)
      console.log('↷ already applied — recorded')
    } else {
      console.log('✗ FAILED')
      console.error(`\nError output:\n${(stderr || '').slice(0, 600)}`)
      console.error('\nStopping. Fix the error above and retry.')
      process.exit(1)
    }
  }

  console.log('\nRemote migrations complete.')
}

run().catch(e => {
  console.error('\nFatal:', e.message)
  process.exit(1)
})
