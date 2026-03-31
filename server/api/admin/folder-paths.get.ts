// Returns all available folder paths for the parent-path picker.
// Includes: root (/), all distinct parentPath values, and paths derived from isFolder records.

import { eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  const rows = await db
    .select({ slug: notes.slug, parentPath: notes.parentPath, isFolder: notes.isFolder })
    .from(notes)

  const paths = new Set<string>(['/'])

  for (const row of rows) {
    // Every parentPath in use is a valid target
    if (row.parentPath) paths.add(row.parentPath)
    // Explicit folder records: their own path is also a valid parent
    if (row.isFolder) paths.add(`/${row.slug}`)
  }

  return [...paths].sort((a, b) => a.localeCompare(b))
})
