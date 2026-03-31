import { asc, eq } from 'drizzle-orm'
import { notes } from '~/server/utils/db/schema'

export interface NavNode {
  title: string
  slug: string
  path: string      // empty string = virtual folder (not clickable)
  createdAt: string // ISO-ish string; used for sorting; '' for virtual folders
  children: NavNode[]
}

interface NoteRow {
  title: string
  slug: string
  parentPath: string
  createdAt: string
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
        children: [],
      })
      slugSet.add(folderSlug)
    }
  }

  function attach(parentPath: string): NavNode[] {
    const nodes = byParent.get(parentPath) || []
    for (const node of nodes) {
      node.children = attach(`/${node.slug}`)
    }
    // Real notes sorted by createdAt DESC (newest first); virtual folders by title
    return nodes.sort((a, b) => {
      if (a.path && b.path) return b.createdAt.localeCompare(a.createdAt)
      if (!a.path && !b.path) return a.title.localeCompare(b.title)
      return a.path ? -1 : 1 // real notes before virtual folders at same level
    })
  }

  return attach('/')
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const results = await db
    .select({ title: notes.title, slug: notes.slug, parentPath: notes.parentPath, createdAt: notes.createdAt })
    .from(notes)
    .where(eq(notes.isPublished, true))
    .orderBy(asc(notes.parentPath))
  return buildTree(results)
})
