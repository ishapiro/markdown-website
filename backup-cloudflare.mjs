/**
 * Backup remote Cloudflare D1 database and R2 storage to a local directory.
 *
 * Usage:
 *   node backup-cloudflare.mjs           — backup both D1 and R2
 *   node backup-cloudflare.mjs --list    — list existing backups
 *   node backup-cloudflare.mjs --db-only  — backup D1 only
 *   node backup-cloudflare.mjs --r2-only  — backup R2 only
 *
 * Backups are written to: ./cloudflare-backups/<timestamp>/
 *   db.sql        — SQL dump of the remote D1 database
 *   r2/<key>      — each R2 object, preserving its full key path
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const DB_NAME = 'cogitations-db'
const R2_BUCKET = 'cogitations-vault'
const BACKUP_DIR = './cloudflare-backups'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((d) => fs.statSync(path.join(BACKUP_DIR, d)).isDirectory())
    .sort()
    .reverse() // newest first
}

// ── D1 ────────────────────────────────────────────────────────────────────────

async function backupD1(backupPath) {
  console.log('\n─── Backing up remote D1 database ───')

  const sqlFile = path.join(backupPath, 'db.sql')
  try {
    execSync(
      `npx wrangler d1 export ${DB_NAME} --remote --output ${sqlFile}`,
      { stdio: 'inherit' },
    )
  } catch {
    console.error('Failed to export remote D1.')
    process.exit(1)
  }

  const bytes = fs.statSync(sqlFile).size
  console.log(`✓ D1 backup saved: db.sql (${(bytes / 1024).toFixed(1)} KB)`)
}

// ── R2 ────────────────────────────────────────────────────────────────────────

// wrangler 4.x has no `r2 object list` command — use D1 as the source of R2 keys
// (every R2 object in this app has a corresponding notes.r2_key in D1)
async function listR2KeysFromD1() {
  const result = spawnSync(
    'npx',
    [
      'wrangler', 'd1', 'execute', DB_NAME,
      '--remote', '--json',
      '--command', 'SELECT r2_key FROM notes WHERE r2_key IS NOT NULL',
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`D1 query failed:\n${result.stderr}`)

  // wrangler --json outputs an array: [{ results: [{r2_key: ...}], ... }]
  const parsed = JSON.parse(result.stdout)
  const rows = parsed[0]?.results ?? parsed?.results ?? []
  return rows.map((r) => r.r2_key).filter(Boolean)
}

async function backupR2(backupPath) {
  console.log('\n─── Backing up remote R2 storage ───')

  let keys
  try {
    keys = await listR2KeysFromD1()
  } catch (e) {
    console.error('Failed to list R2 keys from D1:', e.message)
    process.exit(1)
  }

  if (keys.length === 0) {
    console.log('No R2 keys found in D1.')
    return
  }

  console.log(`Found ${keys.length} R2 key(s).`)

  let downloaded = 0
  let failed = 0

  for (const key of keys) {
    const destFile = path.join(backupPath, 'r2', key)
    fs.mkdirSync(path.dirname(destFile), { recursive: true })

    process.stdout.write(`  ↓ ${key} … `)
    const result = spawnSync(
      'npx',
      [
        'wrangler', 'r2', 'object', 'get',
        `${R2_BUCKET}/${key}`,
        '--file', destFile,
        '--remote',
      ],
      { encoding: 'utf8' },
    )

    if (result.status === 0) {
      process.stdout.write('OK\n')
      downloaded++
    } else {
      process.stdout.write('FAILED\n')
      if (result.stderr) console.error('   ', result.stderr.trim())
      failed++
    }
  }

  console.log(`\n✓ R2 backup complete: ${downloaded} downloaded, ${failed} failed.`)
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--list') || args.includes('-l')) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log('No backups found.')
    } else {
      console.log(`Backups in ${BACKUP_DIR}/:\n`)
      backups.forEach((d, i) =>
        console.log(`  ${i === 0 ? '→ ' : '  '}${d}${i === 0 ? '  (most recent)' : ''}`),
      )
    }
    return
  }

  const dbOnly = args.includes('--db-only')
  const r2Only = args.includes('--r2-only')

  const ts = makeTimestamp()
  const backupPath = path.join(BACKUP_DIR, ts)
  fs.mkdirSync(backupPath, { recursive: true })
  console.log(`Creating backup: ${backupPath}`)

  if (!r2Only) await backupD1(backupPath)
  if (!dbOnly) await backupR2(backupPath)

  console.log('\nBackup complete:', backupPath)
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
