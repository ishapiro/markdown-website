import { asc, eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

export interface NavNode {
  title: string
  slug: string
  path: string       // empty string = virtual folder (not clickable)
  createdAt: string  // ISO-ish string; used for sorting; '' for virtual folders
  sortOrder: number | null
  children: NavNode[]
}

interface NoteRow {
  title: string
  slug: string
  parentPath: string
  createdAt: string
  sortOrder: number | null
}

function buildTree(rows: NoteRow[]): NavNode[] {
  const byParent = new Map<string, NavNode[]>()
  const slugSet = new Set(rows.map((r) => r.slug))

  for (const row of rows) {
    const parent = row.parentPath || '/'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push({
      title: row.title,
      slug: row.slug,
      path: `/${row.slug}`,
      createdAt: row.createdAt,
      sortOrder: row.sortOrder,
      children: [],
    })
  }

  // Inject virtual folder nodes for parents with no real note
  for (const parentPath of byParent.keys()) {
    if (parentPath === '/') continue
    const folderSlug = parentPath.slice(1)
    if (slugSet.has(folderSlug)) continue

    const folderTitle = folderSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const parts = folderSlug.split('/')
    const grandParent = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/'

    if (!byParent.has(grandParent)) byParent.set(grandParent, [])

    if (!byParent.get(grandParent)!.find((n) => n.slug === folderSlug)) {
      byParent.get(grandParent)!.push({
        title: folderTitle,
        slug: folderSlug,
        path: '',
        createdAt: '',
        sortOrder: null,
        children: [],
      })
      slugSet.add(folderSlug)
    }
  }

  function sortNodes(nodes: NavNode[]): NavNode[] {
    return nodes.sort((a, b) => {
      const aIsReal = !!a.path
      const bIsReal = !!b.path

      // Real notes before virtual folders at the same level
      if (aIsReal !== bIsReal) return aIsReal ? -1 : 1

      if (aIsReal && bIsReal) {
        // Both real notes: sort_order ASC, null treated as 9999
        const aOrder = a.sortOrder ?? 9999
        const bOrder = b.sortOrder ?? 9999
        return aOrder - bOrder
      }

      // Both virtual folders: use min child sort_order (null → 9999), then title
      const aChildOrder = a.children.find(c => c.sortOrder !== null)?.sortOrder ?? 9999
      const bChildOrder = b.children.find(c => c.sortOrder !== null)?.sortOrder ?? 9999
      if (aChildOrder !== bChildOrder) return aChildOrder - bChildOrder
      return a.title.localeCompare(b.title)
    })
  }

  function attach(parentPath: string): NavNode[] {
    const nodes = byParent.get(parentPath) || []
    for (const node of nodes) {
      node.children = attach(`/${node.slug}`)
    }
    return sortNodes(nodes)
  }

  return attach('/')
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const results = await db
    .select({
      title: notes.title,
      slug: notes.slug,
      parentPath: notes.parentPath,
      createdAt: notes.createdAt,
      sortOrder: notes.sortOrder,
    })
    .from(notes)
    .where(eq(notes.isPublished, true))
    .orderBy(asc(notes.parentPath))
  return buildTree(results)
})
