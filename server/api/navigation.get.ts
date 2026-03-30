// Returns the full navigation tree for the sidebar.

interface NoteRow {
  title: string
  slug: string
  parent_path: string
}

export interface NavNode {
  title: string
  slug: string
  path: string   // empty string = virtual folder (not clickable)
  children: NavNode[]
}

function buildTree(rows: NoteRow[]): NavNode[] {
  const byParent = new Map<string, NavNode[]>()
  const slugSet = new Set(rows.map((r) => r.slug))

  // Index all real notes by their parent
  for (const row of rows) {
    const parent = row.parent_path || '/'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push({
      title: row.title,
      slug: row.slug,
      path: `/${row.slug}`,
      children: [],
    })
  }

  // For any parent path that has no corresponding real note,
  // inject a virtual folder node one level up
  for (const parentPath of byParent.keys()) {
    if (parentPath === '/') continue
    const folderSlug = parentPath.slice(1) // e.g. 'startup-advice'
    if (slugSet.has(folderSlug)) continue  // already a real note

    const folderTitle = folderSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    // Determine grandparent path
    const parts = folderSlug.split('/')
    const grandParent = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/'

    if (!byParent.has(grandParent)) byParent.set(grandParent, [])

    // Only add once
    if (!byParent.get(grandParent)!.find((n) => n.slug === folderSlug)) {
      byParent.get(grandParent)!.push({
        title: folderTitle,
        slug: folderSlug,
        path: '',  // virtual — sidebar renders as non-clickable label
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
    return nodes.sort((a, b) => a.title.localeCompare(b.title))
  }

  return attach('/')
}

export default defineEventHandler(async () => {
  const db = useDatabase()
  const result = await db.sql<NoteRow>`
    SELECT title, slug, parent_path
    FROM notes
    WHERE is_published = 1
    ORDER BY parent_path ASC, title ASC
  `
  return buildTree(result.rows)
})
