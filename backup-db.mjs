/**
 * On-demand backup of the local D1 database.
 * Copies the wrangler SQLite file to db-backups/ with a timestamp.
 *
 * Usage: node backup-db.mjs
 */

import fs from 'fs'
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

async function main() {
  const dbPath = await findDbFile()
  if (!dbPath) {
    console.error('No local D1 database found. Has the dev server been run at least once?')
    process.exit(1)
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dest = `${BACKUP_DIR}/cogitations-${ts}.sqlite`

  fs.copyFileSync(dbPath, dest)
  for (const ext of ['-wal', '-shm']) {
    const src = dbPath + ext
    if (fs.existsSync(src)) fs.copyFileSync(src, dest + ext)
  }

  console.log(`Backed up to: ${dest}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
