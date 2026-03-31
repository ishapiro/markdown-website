<script setup lang="ts">
const props = defineProps<{ currentSlug: string; refreshTrigger?: number }>()
const emit = defineEmits<{ select: [slug: string] }>()

interface NoteRow {
  title: string
  slug: string
  isPublished: boolean
  isFolder: boolean
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

// New folder form state
const showNewFolder = ref(false)
const newFolderName = ref('')
const newFolderSlug = ref('')
const newFolderParent = ref('/')
const creatingFolder = ref(false)

watch(newFolderName, (name) => {
  newFolderSlug.value = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
})

function cancelNewFolder() {
  showNewFolder.value = false
  newFolderName.value = ''
  newFolderSlug.value = ''
  newFolderParent.value = '/'
}

async function createFolder() {
  if (!newFolderName.value.trim() || !newFolderSlug.value.trim()) return
  creatingFolder.value = true
  try {
    await $fetch('/api/admin/folders', {
      method: 'POST',
      body: {
        name: newFolderName.value.trim(),
        slug: newFolderSlug.value.trim(),
        parentPath: newFolderParent.value || '/',
      },
    })
    cancelNewFolder()
    await refresh()
  } catch (e: unknown) {
    alert((e as { data?: { message?: string } })?.data?.message ?? 'Failed to create folder')
  } finally {
    creatingFolder.value = false
  }
}

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
      isFolder: row.isFolder,
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
        const aOrder = a.sortOrder ?? 9999
        const bOrder = b.sortOrder ?? 9999
        return aOrder - bOrder
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
          isFolder: n.isFolder,
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

function childCount(folderSlug: string): number {
  return (notes.value ?? []).filter((n) => n.parentPath === `/${folderSlug}`).length
}

// Check if a folder node is DB-backed (has a real record) vs purely virtual
function isFolderInDb(slug: string): boolean {
  return (notes.value ?? []).some((n) => n.slug === slug && n.isFolder)
}

async function deleteNote(slug: string) {
  if (!confirm(`Unpublish "${slug}"?`)) return
  deleting.value = slug
  await $fetch(`/api/admin/notes/${slug}`, { method: 'DELETE' }).catch(() => null)
  deleting.value = null
  await refresh()
}

async function deleteFolder(node: TreeNode) {
  const count = childCount(node.slug)
  const childMsg = count > 0 ? ` ${count} note${count === 1 ? '' : 's'} inside will be moved to its parent section.` : ''
  if (!confirm(`Delete folder "${node.title}"?${childMsg}`)) return
  deleting.value = node.slug
  await $fetch(`/api/admin/notes/${node.slug}?hard=true`, { method: 'DELETE' }).catch(() => null)
  deleting.value = null
  await refresh()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header: Search + New Folder button -->
    <div class="px-2 pb-2 flex gap-1">
      <input
        v-model="search"
        type="text"
        placeholder="Search notes…"
        class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-text outline-none placeholder:text-vault-faint focus:border-vault-accent"
      />
      <button
        title="New folder"
        class="shrink-0 rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-muted hover:text-vault-accent hover:border-vault-accent transition-colors font-medium"
        @click="showNewFolder = !showNewFolder"
      >
        + Folder
      </button>
    </div>

    <!-- New folder form -->
    <div v-if="showNewFolder" class="px-2 pb-2 space-y-1 border-b border-vault-border mb-1">
      <input
        v-model="newFolderName"
        type="text"
        placeholder="Folder name"
        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-text outline-none placeholder:text-vault-faint focus:border-vault-accent"
        @keydown.enter="createFolder"
        @keydown.escape="cancelNewFolder"
      />
      <input
        v-model="newFolderSlug"
        type="text"
        placeholder="slug"
        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-text outline-none placeholder:text-vault-faint focus:border-vault-accent font-mono"
      />
      <input
        v-model="newFolderParent"
        type="text"
        placeholder="Parent path (e.g. /)"
        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs text-vault-text outline-none placeholder:text-vault-faint focus:border-vault-accent font-mono"
      />
      <div class="flex gap-1">
        <button
          :disabled="creatingFolder || !newFolderName.trim()"
          class="flex-1 rounded bg-vault-accent text-white px-2 py-1 text-xs disabled:opacity-50"
          @click="createFolder"
        >
          {{ creatingFolder ? 'Creating…' : 'Create' }}
        </button>
        <button
          class="flex-1 rounded border border-vault-border px-2 py-1 text-xs text-vault-muted hover:text-vault-text"
          @click="cancelNewFolder"
        >
          Cancel
        </button>
      </div>
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
          <!-- Folder node -->
          <template v-if="node.isFolder">
            <span class="flex-1 flex items-center gap-1 py-1 pr-2 text-xs font-semibold text-vault-muted uppercase tracking-wide select-none">
              <span class="opacity-50">▸</span>
              {{ node.title }}
            </span>
            <button
              v-if="isFolderInDb(node.slug)"
              class="shrink-0 text-vault-faint hover:text-red-400 px-1 text-xs"
              title="Delete folder"
              :disabled="deleting === node.slug"
              @click.stop="deleteFolder(node)"
            >
              ✕
            </button>
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
