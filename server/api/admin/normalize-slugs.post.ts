// One-time migration: normalize all slugs and parentPaths in the database.
// Collapses multiple spaces/hyphens to a single hyphen, trims edge hyphens per segment.
// Also renames R2 keys to match the new slug when the slug changes.

import { eq, sql } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

function normalizeSegments(raw: string): string {
  return raw
    .split('/')
    .map((seg) => seg.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/')
}

function normalizeParentPath(raw: string): string {
  if (raw === '/') return '/'
  return '/' + normalizeSegments(raw.replace(/^\//, ''))
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const r2 = useR2(event)

  const rows = await db
    .select({ id: notes.id, slug: notes.slug, parentPath: notes.parentPath, r2Key: notes.r2Key, isFolder: notes.isFolder })
    .from(notes)

  let normalized = 0
  const skipped: string[] = []

  for (const row of rows) {
    const newSlug = normalizeSegments(row.slug)
    const newParentPath = normalizeParentPath(row.parentPath)
    const slugChanged = newSlug !== row.slug
    const parentChanged = newParentPath !== row.parentPath

    if (!slugChanged && !parentChanged) continue

    // Compute new R2 key (folders have no r2Key)
    let newR2Key = row.r2Key
    if (slugChanged && row.r2Key) {
      newR2Key = `notes/${newSlug}.md`
      // Copy content to the new key, then delete the old one
      const obj = await r2.get(row.r2Key)
      if (obj) {
        const content = await obj.text()
        await r2.put(newR2Key, content, { httpMetadata: { contentType: 'text/markdown' } })
        await r2.delete(row.r2Key)
      }
    }

    try {
      await db
        .update(notes)
        .set({ slug: newSlug, parentPath: newParentPath, r2Key: newR2Key, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(notes.id, row.id))
      normalized++
    } catch {
      // Most likely a UNIQUE constraint violation — another record already has the normalized slug
      skipped.push(`${row.slug} → ${newSlug} (collision)`)
    }
  }

  return { normalized, skipped }
})
