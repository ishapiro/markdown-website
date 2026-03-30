/**
 * Vault Migration Script
 * Imports Markdown files from a local ./vault directory into the Cogitations app
 * via the admin API running locally.
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Place your .md files in ./vault/ (any folder depth)
 *   3. Run: node migrate.mjs
 *
 * Options (env vars):
 *   BASE_URL   - default: http://localhost:3000
 *   VAULT_DIR  - default: ./vault
 */

import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const VAULT_DIR = process.env.VAULT_DIR || './vault'

function fileToSlug(filePath, vaultDir) {
  const relative = path.relative(vaultDir, filePath)
  return relative
    .replace(/\.md$/, '')
    .replace(/\\/g, '/')        // Windows compat
    .toLowerCase()
    .replace(/[^a-z0-9\/\-]/g, '-')
    .replace(/-+/g, '-')
}

function fileToParentPath(filePath, vaultDir) {
  const relative = path.relative(vaultDir, filePath)
  const dir = path.dirname(relative)
  if (dir === '.') return '/'
  return '/' + dir.replace(/\\/g, '/').toLowerCase().replace(/[^a-z0-9\/\-]/g, '-')
}

function extractTitle(content, filename) {
  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()
  return filename
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

async function migrate() {
  if (!fs.existsSync(VAULT_DIR)) {
    console.error(`Vault directory not found: ${VAULT_DIR}`)
    process.exit(1)
  }

  const files = await globby(`${VAULT_DIR}/**/*.md`)
  console.log(`Found ${files.length} Markdown files in ${VAULT_DIR}`)

  let ok = 0
  let fail = 0

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const slug = fileToSlug(file, VAULT_DIR)
    const parentPath = fileToParentPath(file, VAULT_DIR)
    const filename = path.basename(file, '.md')
    const title = extractTitle(content, filename)

    try {
      const res = await fetch(`${BASE_URL}/api/admin/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bypass auth check in development by spoofing the CF Access header
          'cf-access-authenticated-user-email': 'migrate@local',
        },
        body: JSON.stringify({ title, slug, parent_path: parentPath, content, is_published: true }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`  ✗ ${slug}: ${res.status} ${err}`)
        fail++
      } else {
        console.log(`  ✓ ${slug}`)
        ok++
      }
    } catch (e) {
      console.error(`  ✗ ${slug}: ${e.message}`)
      fail++
    }
  }

  console.log(`\nDone. ${ok} migrated, ${fail} failed.`)
}

migrate()
