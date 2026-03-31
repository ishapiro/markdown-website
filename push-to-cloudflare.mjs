/**
 * Push local D1 database and R2 storage to Cloudflare (remote).
 *
 * Usage:
 *   node push-to-cloudflare.mjs           — push both D1 and R2
 *   node push-to-cloudflare.mjs --db-only  — push D1 only
 *   node push-to-cloudflare.mjs --r2-only  — push R2 only
 *
 * WARNING: This REPLACES the remote database with your local data.
 *          R2 objects are upserted (remote-only objects are NOT deleted).
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const DB_NAME = 'cogitations-db'
const R2_BUCKET = 'cogitations-vault'
const R2_STATE_DIR = '.wrangler/state/v3/r2'
const TMP_DIR = './tmp-push'

// ── D1 ────────────────────────────────────────────────────────────────────────

async function findLocalD1File() {
  const files = await globby('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite', {
    ignore: ['**/*.sqlite-shm', '**/*.sqlite-wal'],
  })
  if (files.length > 1) console.warn(`Warning: multiple D1 files found, using: ${files[0]}`)
  return files[0] ?? null
}

// Tables that are internal to Cloudflare/miniflare and must not be touched
const SKIP_TABLES = new Set(['_cf_METADATA', '_cf_KV'])

async function generateDumpSqlAsync(dbPath) {
  const Database = (await import('better-sqlite3')).default
  const db = new Database(dbPath, { readonly: true })

  const lines = []

  // D1 remote does NOT allow BEGIN TRANSACTION or PRAGMA statements in SQL
  // files — omit them entirely. Each statement is executed individually.

  // Get all user tables (exclude sqlite internals and Cloudflare internals)
  const tables = db
    .prepare(
      `SELECT name, sql FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY rootpage`,
    )
    .all()
    .filter((t) => !SKIP_TABLES.has(t.name))

  console.log(`  Tables found: ${tables.map((t) => t.name).join(', ')}`)

  // Drop in reverse order so foreign-key children are dropped before parents
  for (const t of [...tables].reverse()) {
    lines.push(`DROP TABLE IF EXISTS "${t.name}";`)
  }
  lines.push('')

  // Re-create and populate each table
  for (const t of tables) {
    lines.push(`-- Table: ${t.name}`)
    lines.push(t.sql + ';')

    const rows = db.prepare(`SELECT * FROM "${t.name}"`).all()
    console.log(`  ${t.name}: ${rows.length} row(s)`)

    if (rows.length > 0) {
      const cols = Object.keys(rows[0])
      const colList = cols.map((c) => `"${c}"`).join(', ')
      for (const row of rows) {
        const vals = cols.map((c) => {
          const v = row[c]
          if (v === null || v === undefined) return 'NULL'
          if (typeof v === 'number') return String(v)
          return `'${String(v).replace(/'/g, "''")}'`
        })
        lines.push(`INSERT INTO "${t.name}" (${colList}) VALUES (${vals.join(', ')});`)
      }
    }
    lines.push('')
  }

  db.close()
  return lines.join('\n')
}

async function pushD1() {
  console.log('\n─── Pushing D1 database to Cloudflare ───')

  const dbPath = await findLocalD1File()
  if (!dbPath) {
    console.error('No local D1 database found. Has the dev server been run at least once?')
    process.exit(1)
  }
  console.log(`Local D1 file: ${dbPath}`)

  console.log('Generating SQL dump from local database…')
  const sql = await generateDumpSqlAsync(dbPath)

  fs.mkdirSync(TMP_DIR, { recursive: true })
  const importFile = path.join(TMP_DIR, 'remote-import.sql')
  fs.writeFileSync(importFile, sql)
  console.log(`SQL dump written: ${importFile} (${(sql.length / 1024).toFixed(1)} KB, ${sql.split('\n').length} lines)`)

  console.log('Executing SQL against remote D1…')
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file ${importFile}`, {
      stdio: 'inherit',
    })
    console.log('✓ D1 push complete.')
  } catch (e) {
    console.error('Remote D1 execute failed:', e.message)
    console.error(`The SQL file is preserved at: ${importFile}`)
    console.error('You can inspect it and run manually:')
    console.error(`  npx wrangler d1 execute ${DB_NAME} --remote --file ${importFile}`)
    process.exit(1)
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true })
}

// ── R2 ────────────────────────────────────────────────────────────────────────

async function findR2MetadataDb() {
  const files = await globby(
    `${R2_STATE_DIR}/miniflare-R2BucketObject/*.sqlite`,
    { ignore: ['**/*.sqlite-shm', '**/*.sqlite-wal'] },
  )
  return files[0] ?? null
}

async function pushR2() {
  console.log('\n─── Pushing R2 storage to Cloudflare ───')

  const metaDb = await findR2MetadataDb()
  if (!metaDb) {
    console.warn('No local R2 metadata database found — skipping R2 push.')
    console.warn('(Start the dev server once to initialise local R2 state.)')
    return
  }
  console.log(`R2 metadata DB: ${metaDb}`)

  const Database = (await import('better-sqlite3')).default
  const db = new Database(metaDb, { readonly: true })
  const objects = db
    .prepare('SELECT key, blob_id, http_metadata FROM _mf_objects ORDER BY key')
    .all()
  db.close()

  if (objects.length === 0) {
    console.log('No local R2 objects found.')
    return
  }

  console.log(`Found ${objects.length} local R2 object(s).`)

  const blobsDir = path.join(R2_STATE_DIR, R2_BUCKET, 'blobs')
  let pushed = 0
  let failed = 0

  for (const obj of objects) {
    const blobPath = path.join(blobsDir, obj.blob_id)
    if (!fs.existsSync(blobPath)) {
      console.warn(`  ⚠ Blob missing for key: ${obj.key}  (blob_id: ${obj.blob_id})`)
      failed++
      continue
    }

    const meta = JSON.parse(obj.http_metadata || '{}')
    const contentType = meta.contentType || 'application/octet-stream'
    const sizeKB = (fs.statSync(blobPath).size / 1024).toFixed(1)

    process.stdout.write(`  ↑ ${obj.key} (${sizeKB} KB, ${contentType}) … `)
    const result = spawnSync(
      'npx',
      [
        'wrangler', 'r2', 'object', 'put',
        `${R2_BUCKET}/${obj.key}`,
        '--file', blobPath,
        '--content-type', contentType,
        '--remote',
      ],
      { encoding: 'utf8' },
    )

    if (result.status === 0) {
      process.stdout.write('OK\n')
      pushed++
    } else {
      process.stdout.write('FAILED\n')
      // Print both stdout and stderr to help diagnose
      if (result.stdout?.trim()) console.error('    stdout:', result.stdout.trim())
      if (result.stderr?.trim()) console.error('    stderr:', result.stderr.trim())
      failed++
    }
  }

  console.log(`\n✓ R2 push complete: ${pushed} uploaded, ${failed} failed.`)
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dbOnly = args.includes('--db-only')
  const r2Only = args.includes('--r2-only')

  console.log('⚠  WARNING: This will REPLACE remote Cloudflare D1 data with your local data.')
  console.log('   R2 objects are upserted; remote-only R2 objects are NOT deleted.')

  if (!r2Only) await pushD1()
  if (!dbOnly) await pushR2()

  console.log('\nDone.')
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
