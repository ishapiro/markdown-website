/**
 * Restore a local backup (created by backup-cloudflare.mjs) to Cloudflare.
 *
 * Usage:
 *   node restore-to-cloudflare.mjs              — restore most recent backup
 *   node restore-to-cloudflare.mjs --list       — list available backups
 *   node restore-to-cloudflare.mjs <dir>        — restore a specific backup
 *   node restore-to-cloudflare.mjs --db-only    — restore D1 only
 *   node restore-to-cloudflare.mjs --r2-only    — restore R2 only
 *
 * WARNING: This REPLACES the remote Cloudflare data with the backup.
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const DB_NAME = 'cogitations-db'
const R2_BUCKET = 'cogitations-vault'
const BACKUP_DIR = './cloudflare-backups'

// ── helpers ───────────────────────────────────────────────────────────────────

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((d) => fs.statSync(path.join(BACKUP_DIR, d)).isDirectory())
    .sort()
    .reverse() // newest first
}

function walkDir(dir, baseDir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, baseDir))
    } else {
      files.push({ file: fullPath, key: path.relative(baseDir, fullPath) })
    }
  }
  return files
}

// ── D1 ────────────────────────────────────────────────────────────────────────

async function restoreD1(backupPath) {
  console.log('\n─── Restoring D1 database to Cloudflare ───')

  const sqlFile = path.join(backupPath, 'db.sql')
  if (!fs.existsSync(sqlFile)) {
    console.warn(`No db.sql found in ${backupPath} — skipping D1 restore.`)
    return
  }

  console.log(`Executing ${sqlFile} against remote D1 (this may take a moment)…`)
  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --file ${sqlFile}`,
      { stdio: 'inherit' },
    )
    console.log('✓ D1 restore complete.')
  } catch {
    console.error('Remote D1 restore failed.')
    process.exit(1)
  }
}

// ── R2 ────────────────────────────────────────────────────────────────────────

async function restoreR2(backupPath) {
  console.log('\n─── Restoring R2 storage to Cloudflare ───')

  const r2Dir = path.join(backupPath, 'r2')
  if (!fs.existsSync(r2Dir)) {
    console.warn(`No r2/ directory found in ${backupPath} — skipping R2 restore.`)
    return
  }

  const files = walkDir(r2Dir, r2Dir)
  if (files.length === 0) {
    console.log('No R2 files found in backup.')
    return
  }

  console.log(`Found ${files.length} R2 file(s) to restore.`)

  let uploaded = 0
  let failed = 0

  for (const { file, key } of files) {
    process.stdout.write(`  ↑ ${key} … `)
    const result = spawnSync(
      'npx',
      [
        'wrangler', 'r2', 'object', 'put',
        `${R2_BUCKET}/${key}`,
        '--file', file,
        '--remote',
      ],
      { encoding: 'utf8' },
    )

    if (result.status === 0) {
      process.stdout.write('OK\n')
      uploaded++
    } else {
      process.stdout.write('FAILED\n')
      if (result.stderr) console.error('   ', result.stderr.trim())
      failed++
    }
  }

  console.log(`\n✓ R2 restore complete: ${uploaded} uploaded, ${failed} failed.`)
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--list') || args.includes('-l')) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log('No backups found.')
    } else {
      console.log(`Available backups in ${BACKUP_DIR}/:\n`)
      backups.forEach((d, i) =>
        console.log(`  ${i === 0 ? '→ ' : '  '}${d}${i === 0 ? '  (most recent)' : ''}`),
      )
    }
    return
  }

  const dbOnly = args.includes('--db-only')
  const r2Only = args.includes('--r2-only')
  const explicitDir = args.find((a) => !a.startsWith('--'))

  let backupPath
  if (explicitDir) {
    backupPath = explicitDir.includes(path.sep)
      ? explicitDir
      : path.join(BACKUP_DIR, explicitDir)
  } else {
    const backups = listBackups()
    if (backups.length === 0) {
      console.error('No backups found in cloudflare-backups/. Run npm run backup:cloudflare first.')
      process.exit(1)
    }
    backupPath = path.join(BACKUP_DIR, backups[0])
    console.log(`Using most recent backup: ${backups[0]}`)
  }

  if (!fs.existsSync(backupPath)) {
    console.error(`Backup not found: ${backupPath}`)
    process.exit(1)
  }

  console.log()
  console.log('⚠  WARNING: This will REPLACE the remote Cloudflare data with the backup.')
  console.log(`   Backup: ${backupPath}`)
  console.log()

  if (!r2Only) await restoreD1(backupPath)
  if (!dbOnly) await restoreR2(backupPath)

  console.log('\nRestore complete.')
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
