/**
 * Restore the local D1 database from a backup.
 *
 * Usage:
 *   node restore-db.mjs           — restore most recent backup
 *   node restore-db.mjs --list    — list available backups
 *   node restore-db.mjs <file>    — restore a specific backup file
 *
 * IMPORTANT: Stop the dev server before restoring.
 */

import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const BACKUP_DIR = './db-backups'

async function findDbFile() {
  const files = await globby('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite', {
    ignore: ['**/*.sqlite-shm', '**/*.sqlite-wal'],
  })
  if (files.length > 1) {
    console.warn(`Warning: multiple D1 SQLite files found, using: ${files[0]}`)
  }
  return files[0] ?? null
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backups found (db-backups/ directory does not exist).')
    return []
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sqlite') && !f.endsWith('-wal') && !f.endsWith('-shm'))
    .sort()
    .reverse() // newest first
  return files
}

async function restore(backupFile) {
  const dbPath = await findDbFile()
  if (!dbPath) {
    console.error('No local D1 database found. Start the dev server once to initialise it, then restore.')
    process.exit(1)
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`Backup file not found: ${backupFile}`)
    process.exit(1)
  }

  console.log(`Restoring: ${backupFile}`)
  console.log(`       to: ${dbPath}`)

  // Remove WAL/SHM files first to avoid corruption
  for (const ext of ['-wal', '-shm']) {
    const f = dbPath + ext
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  fs.copyFileSync(backupFile, dbPath)

  // Restore WAL/SHM if they exist in the backup
  for (const ext of ['-wal', '-shm']) {
    const src = backupFile + ext
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dbPath + ext)
    }
  }

  console.log('Restore complete. Restart the dev server.')
}

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--list') || args.includes('-l')) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log('No backups found.')
    } else {
      console.log(`Available backups in ${BACKUP_DIR}/:\n`)
      backups.forEach((f, i) => console.log(`  ${i === 0 ? '→ ' : '  '}${f}${i === 0 ? '  (most recent)' : ''}`))
    }
    return
  }

  let backupFile
  if (args[0]) {
    // Specific file provided — accept bare filename or full path
    backupFile = args[0].includes('/') ? args[0] : path.join(BACKUP_DIR, args[0])
  } else {
    // Use most recent backup
    const backups = listBackups()
    if (backups.length === 0) {
      console.error('No backups found in db-backups/. Nothing to restore.')
      process.exit(1)
    }
    backupFile = path.join(BACKUP_DIR, backups[0])
    console.log(`Using most recent backup: ${backups[0]}`)
  }

  await restore(backupFile)
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
