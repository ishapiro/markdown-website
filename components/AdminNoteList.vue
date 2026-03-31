<script setup lang="ts">
const props = defineProps<{ currentSlug: string; refreshTrigger?: number }>()
const emit = defineEmits<{ select: [slug: string] }>()

interface NoteRow {
  title: string
  slug: string
  isPublished: boolean
  parentPath: string
  sortOrder: number | null
  createdAt: string
}

interface TreeNode {
  title: string
  slug: string
  isFolder: boolean
  isPublished: boolean
  sortOrder: number | null
  createdAt: string
  children: TreeNode[]
}

const { data: notes, refresh } = await useFetch<NoteRow[]>('/api/admin/list')
const search = ref('')
const deleting = ref<string | null>(null)

watch(() => props.refreshTrigger, () => refresh())

function buildTree(rows: NoteRow[]): TreeNode[] {
  const byParent = new Map<string, TreeNode[]>()
  const slugSet = new Set(rows.map((r) => r.slug))

  for (const row of rows) {
    const parent = row.parentPath || '/'
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent)!.push({
      title: row.title || row.slug,
      slug: row.slug,
      isFolder: false,
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      children: [],
    })
  }

  // Inject virtual folder nodes for parents that have no real note
  for (const parentPath of byParent.keys()) {
    if (parentPath === '/') continue
    const folderSlug = parentPath.slice(1)
    if (slugSet.has(folderSlug)) continue

    const parts = folderSlug.split('/')
    const lastPart = parts[parts.length - 1]
    const folderTitle = lastPart
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    const grandParent = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/'
    if (!byParent.has(grandParent)) byParent.set(grandParent, [])

    if (!byParent.get(grandParent)!.find((n) => n.slug === folderSlug)) {
      byParent.get(grandParent)!.push({
        title: folderTitle,
        slug: folderSlug,
        isFolder: true,
        isPublished: true,
        sortOrder: null,
        createdAt: '',
        children: [],
      })
      slugSet.add(folderSlug)
    }
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      const aIsReal = !a.isFolder
      const bIsReal = !b.isFolder
      if (aIsReal !== bIsReal) return aIsReal ? -1 : 1
      if (aIsReal && bIsReal) {
        const aHas = a.sortOrder !== null
        const bHas = b.sortOrder !== null
        if (aHas && bHas) return a.sortOrder! - b.sortOrder!
        if (aHas) return -1
        if (bHas) return 1
        return b.createdAt.localeCompare(a.createdAt)
      }
      return a.title.localeCompare(b.title)
    })
  }

  function attach(parentPath: string): TreeNode[] {
    const nodes = byParent.get(parentPath) || []
    for (const node of nodes) {
      node.children = attach(`/${node.slug}`)
    }
    return sortNodes(nodes)
  }

  return attach('/')
}

function flattenTree(nodes: TreeNode[], depth = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children.length) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

const flatList = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q) {
    // Flat filtered list when searching
    return (notes.value ?? [])
      .filter((n) => n.title.toLowerCase().includes(q) || n.slug.includes(q))
      .map((n) => ({
        node: {
          title: n.title || n.slug,
          slug: n.slug,
          isFolder: false,
          isPublished: n.isPublished,
          sortOrder: n.sortOrder,
          createdAt: n.createdAt,
          children: [],
        } as TreeNode,
        depth: 0,
      }))
  }
  return flattenTree(buildTree(notes.value ?? []))
})

async function deleteNote(slug: string) {
  if (!confirm(`Unpublish "${slug}"?`)) return
  deleting.value = slug
  await $fetch(`/api/admin/notes/${slug}`, { method: 'DELETE' }).catch(() => null)
  deleting.value = null
  await refresh()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Search -->
    <div class="px-2 pb-2">
      <input
        v-model="search"
        type="text"
        placeholder="Search notes…"
        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-text outline-none placeholder:text-vault-faint focus:border-vault-accent"
      />
    </div>

    <!-- Tree list -->
    <div class="flex-1 overflow-y-auto">
      <ul class="space-y-0">
        <li
          v-for="{ node, depth } in flatList"
          :key="node.slug"
          class="group flex items-center"
          :style="{ paddingLeft: `${depth * 12 + 4}px` }"
        >
          <!-- Virtual folder (non-clickable header) -->
          <template v-if="node.isFolder">
            <span class="flex-1 flex items-center gap-1 py-1 pr-2 text-xs font-semibold text-vault-muted uppercase tracking-wide select-none">
              <span class="opacity-50">▸</span>
              {{ node.title }}
            </span>
          </template>

          <!-- Real note (clickable) -->
          <template v-else>
            <button
              class="flex-1 text-left py-1 pr-1 text-xs rounded transition-colors truncate min-w-0"
              :class="[
                node.slug === currentSlug
                  ? 'text-vault-accent font-semibold bg-vault-accent/10'
                  : node.isPublished
                    ? 'text-vault-text hover:bg-vault-surface'
                    : 'text-vault-muted italic hover:bg-vault-surface',
              ]"
              @click="emit('select', node.slug)"
            >
              <span v-if="!node.isPublished" class="text-vault-faint mr-0.5">○</span>
              <span v-else-if="node.slug === currentSlug" class="mr-0.5">●</span>
              {{ node.title }}
            </button>
            <button
              class="opacity-0 group-hover:opacity-100 shrink-0 text-vault-faint hover:text-red-400 px-1 text-xs"
              title="Unpublish"
              :disabled="deleting === node.slug"
              @click.stop="deleteNote(node.slug)"
            >
              ✕
            </button>
          </template>
        </li>

        <li v-if="!flatList.length" class="px-3 py-4 text-xs text-vault-faint italic">
          {{ search ? 'No matching notes.' : 'No notes yet.' }}
        </li>
      </ul>
    </div>
  </div>
</template>
