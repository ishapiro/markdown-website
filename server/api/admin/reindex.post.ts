// Reindex all published notes: expand content_preview to 2000+100 chars.
// The FTS update trigger fires automatically on each D1 update.

import { eq, sql } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'
import { useR2 } from '~/server/utils/r2'

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const r2 = useR2(event)

  const rows = await db
    .select({ id: notes.id, slug: notes.slug, r2Key: notes.r2Key })
    .from(notes)
    .where(eq(notes.isFolder, false))

  let reindexed = 0

  for (const row of rows) {
    if (!row.r2Key) continue

    const obj = await r2.get(row.r2Key)
    if (!obj) continue

    const content = await obj.text()
    const cleaned = content.replace(/#+\s/g, '').replace(/\n/g, ' ')
    const contentPreview = cleaned.length > 21000
      ? cleaned.slice(0, 20000) + ' ' + cleaned.slice(-1000)
      : cleaned.slice(0, 20000)

    await db
      .update(notes)
      .set({ contentPreview, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(notes.id, row.id))

    reindexed++
  }

  return { reindexed }
})
