/**
 * Image Migration Script
 * Copies images from vault2 into the local NuxtHub blob storage (.data/blob/images/).
 * The fs driver stores files at .data/blob/{key} with a .{key}.$meta.json sidecar.
 *
 * Usage: node migrate-images.mjs
 */

import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

const VAULT_DIR = './vault2/Cogitations Website'
const BLOB_DIR = './.data/blob'
const IMAGE_DIRS = ['images', 'Attachments']

const MIME_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf',
}

function getContentType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

async function migrate() {
  const patterns = IMAGE_DIRS.map(d => `${VAULT_DIR}/${d}/**/*`)
  const files = await globby(patterns, { onlyFiles: true })

  console.log(`Found ${files.length} files to migrate`)

  let ok = 0, skip = 0

  for (const file of files) {
    const filename = path.basename(file)
    // Skip Mac metadata files and DS_Store
    if (filename.startsWith('._') || filename === '.DS_Store') {
      skip++
      continue
    }

    const destKey = `images/${filename}`
    const destPath = path.join(BLOB_DIR, destKey)
    const metaPath = `${destPath}.$meta.json`

    // Ensure destination directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    // Copy the file
    fs.copyFileSync(file, destPath)

    // Write the sidecar meta file
    const stat = fs.statSync(destPath)
    const meta = {
      contentType: getContentType(filename),
      size: stat.size,
      mtime: new Date().toISOString(),
      customMetadata: {},
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta))

    console.log(`  ✓ ${destKey}`)
    ok++
  }

  console.log(`\nDone. ${ok} copied, ${skip} skipped.`)
}

migrate().catch(console.error)
