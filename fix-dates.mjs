/**
 * One-time script: scan every note's title + content and update created_at in D1.
 *
 * Date extraction priority (all found dates are collected; latest wins):
 *   1. "Month DD, YYYY"  e.g. "January 15, 2022"
 *   2. "Month YYYY"       e.g. "September 2022"
 *   3. ISO "YYYY-MM-DD"
 *   4. US  "MM/DD/YYYY"
 *   5. Bare year "YYYY"  (1990-2030 range) — always included, not just as last resort
 *
 * Title (first # heading in the file) is also scanned for dates.
 * If multiple dates found, use the latest (most recent).
 * If no dates found, use 2015-01-01.
 *
 * Usage (server does NOT need to be running):
 *   node fix-dates.mjs
 *   node fix-dates.mjs --dry-run   (preview without writing)
 */

import fs from 'fs'
import { globby } from 'globby'
import { execSync } from 'child_process'

const DRY_RUN = process.argv.includes('--dry-run')
const BLOB_DIR = './.data/blob'
const FALLBACK = new Date('2015-01-01T00:00:00')

const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}
const MONTH_NAMES = Object.keys(MONTH_MAP).join('|')

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

function extractDates(text) {
  const explicit = []  // rules 1-4: dates with an explicit month
  const bare = []      // rule 5: bare year only (Jan 1 fallback)

  const addTo = (arr, y, m = 1, d = 1) => {
    if (y < 1990 || y > 2030) return
    if (m < 1 || m > 12) return   // reject bogus months (e.g. 1995-19-98 false match)
    if (d < 1 || d > 31) return
    const dt = new Date(y, m - 1, d)
    if (!isNaN(dt)) arr.push(dt)
  }

  // 1. "Month DD, YYYY" or "Month DD YYYY"
  const re1 = new RegExp(`\\b(${MONTH_NAMES})\\b[.,\\s]+(\\d{1,2})[,\\s]+(\\d{4})\\b`, 'gi')
  for (const m of text.matchAll(re1)) addTo(explicit, +m[3], MONTH_MAP[m[1].toLowerCase()], +m[2])

  // 2. "Month YYYY"
  const re2 = new RegExp(`\\b(${MONTH_NAMES})\\b[.,\\s]+(\\d{4})\\b`, 'gi')
  for (const m of text.matchAll(re2)) addTo(explicit, +m[2], MONTH_MAP[m[1].toLowerCase()])

  // 3. ISO "YYYY-MM-DD"
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) addTo(explicit, +m[1], +m[2], +m[3])

  // 4. US "MM/DD/YYYY"
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) addTo(explicit, +m[3], +m[1], +m[2])

  // 5. Bare year 1990–2030 — used only when no explicit-month dates were found
  //    Extending range to 1990 catches 1990s copyright notices etc.
  if (explicit.length === 0) {
    for (const m of text.matchAll(/\b((?:19|20)[0-9]{2})\b/g)) addTo(bare, +m[1])
  }

  return explicit.length ? explicit : bare
}

function latest(dates) {
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : FALLBACK
}

function toSql(d) {
  return d.toISOString().slice(0, 10) + ' 00:00:00'
}

async function run() {
  const files = await globby(`${BLOB_DIR}/notes/**/*.md`)
  console.log(`Found ${files.length} notes\n`)

  const updates = []

  for (const file of files) {
    const slug = file.replace(`${BLOB_DIR}/notes/`, '').replace(/\.md$/, '')
    const content = fs.readFileSync(file, 'utf-8')
    const title = extractTitle(content)

    // Combine title + content so dates in the heading are also caught
    const fullText = title ? `${title}\n${content}` : content

    const dates = extractDates(fullText)
    const chosen = latest(dates)
    const dateStr = toSql(chosen)
    const source = dates.length
      ? `${dates.length} date(s) found${title ? ` [title: "${title.slice(0, 40)}"]` : ''}`
      : 'no dates — using fallback'
    console.log(`  ${slug}: ${dateStr}  (${source})`)
    updates.push({ slug, dateStr })
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no changes written.')
    return
  }

  // Build a single SQL file and execute via wrangler
  const sql = updates
    .map(({ slug, dateStr }) =>
      `UPDATE notes SET created_at = '${dateStr}', updated_at = '${dateStr}' WHERE slug = '${slug.replace(/'/g, "''")}';`
    )
    .join('\n')

  const tmpFile = './fix-dates-tmp.sql'
  fs.writeFileSync(tmpFile, sql)

  try {
    execSync(`npx wrangler d1 execute cogitations-db --local --file=${tmpFile}`, { stdio: 'inherit' })
    console.log(`\nDone. Updated ${updates.length} notes.`)
  } finally {
    fs.unlinkSync(tmpFile)
  }
}

run().catch(console.error)
