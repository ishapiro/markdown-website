<script setup lang="ts">
import { marked } from 'marked'
import { FolderIcon, FileTextIcon } from 'lucide-vue-next'
import type { NavNode } from '~/server/api/navigation.get'

const route = useRoute()
const slug = computed(() => (route.params.slug as string[]).join('/'))

const [{ data: note, error }, { data: navTree }] = await Promise.all([
  useFetch(`/api/notes/${slug.value}`, { key: `note-${slug.value}` }),
  useFetch<NavNode[]>('/api/navigation', { key: 'navigation' }),
])

function findNode(nodes: NavNode[], targetSlug: string): NavNode | null {
  for (const node of nodes) {
    if (node.slug === targetSlug) return node
    if (node.children.length) {
      const found = findNode(node.children, targetSlug)
      if (found) return found
    }
  }
  return null
}

const folderNode = computed(() =>
  !note.value ? findNode(navTree.value ?? [], slug.value) : null
)

// Flatten navigation tree into two lookup maps:
//   titleMap: title.toLowerCase() → full slug
//   suffixMap: last slug segment → full slug  (handles WikiLinks that match by filename, not title)
function flattenNav(nodes: NavNode[], titleMap: Map<string, string>, suffixMap: Map<string, string>) {
  for (const node of nodes) {
    if (node.path) {
      titleMap.set(node.title.toLowerCase(), node.slug)
      const suffix = node.slug.split('/').pop()!
      suffixMap.set(suffix, node.slug)
    }
    if (node.children.length) flattenNav(node.children, titleMap, suffixMap)
  }
}
const wikiLinkMap = computed(() => {
  const titleMap = new Map<string, string>()
  const suffixMap = new Map<string, string>()
  flattenNav(navTree.value ?? [], titleMap, suffixMap)
  return { titleMap, suffixMap }
})

if (error.value?.statusCode === 404 && !findNode(navTree.value ?? [], slug.value)) {
  throw createError({ statusCode: 404, message: 'Note not found', fatal: true })
}

// Configure marked for safe rendering
const renderer = new marked.Renderer()

// Override link renderer to open external links in a new tab
renderer.link = (href: string, title: string | null | undefined, text: string) => {
  if (!href) return text
  const isExternal = href.startsWith('http') || href.startsWith('mailto')
  const titleAttr = title ? ` title="${title}"` : ''
  const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  const className = !isExternal ? ' class="internal-link"' : ''
  return `<a href="${href}"${titleAttr}${target}${className}>${text}</a>`
}

marked.use({ renderer })

// Parse Obsidian image embeds: ![[image.jpg]] or ![[path/image.jpg|Alt Text]]
// Converts to standard markdown using just the basename, served from blob storage.
function parseObsidianImages(src: string): string {
  return src.replace(/!\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, imgPath, alt) => {
    const filename = imgPath.split('/').pop() ?? imgPath
    const altText = alt?.trim() || ''
    return `![${altText}](/api/images/images/${filename})`
  })
}

// Parse WikiLinks: [[Path/To/Note|Display Text]] or [[Note Title]]
// Resolution order:
//   1. Exact title match (case-insensitive)
//   2. Slug-suffix match — slug-ify the link text and find a note whose slug ends with it
//   3. Fallback — plain slug-ified link text (may 404)
function parseWikiLinks(src: string, titleMap: Map<string, string>, suffixMap: Map<string, string>): string {
  return src.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, linkPath, alias) => {
    const display = alias || linkPath
    const slugified = linkPath.toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const resolved = titleMap.get(linkPath.toLowerCase()) ?? suffixMap.get(slugified)
    const href = resolved ? `/${resolved}` : `/${slugified}`
    return `[${display}](${href})`
  })
}

function parseVimeoTokens(src: string): string {
  return src.replace(
    /\{\{\s*vimeo:(\d{6,})(?::([a-zA-Z0-9]*))?(?::(\d+))?(?::(\d+))?\s*\}\}/g,
    (_m, id, hash, startStr) => {
      let iframeSrc = hash
        ? `https://player.vimeo.com/video/${id}?h=${hash}`
        : `https://player.vimeo.com/video/${id}`
      if (startStr) iframeSrc += `#t=${startStr}s`
      return `<div class="my-6 aspect-video w-full"><iframe src="${iframeSrc}" class="h-full w-full rounded-lg" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
    },
  )
}

function parseYoutubeTokens(src: string): string {
  return src.replace(
    /\{\{\s*youtube:([a-zA-Z0-9_-]{11})(?::(\d*))?(?::(\d+))?\s*\}\}/g,
    (_m, id, startStr, endStr) => {
      const params: string[] = []
      if (startStr) params.push(`start=${startStr}`)
      if (endStr) params.push(`end=${endStr}`)
      const iframeSrc = `https://www.youtube.com/embed/${id}${params.length ? '?' + params.join('&') : ''}`
      return `<div class="my-6 aspect-video w-full"><iframe src="${iframeSrc}" class="h-full w-full rounded-lg" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    },
  )
}

const renderedContent = computed(() => {
  if (!note.value?.content) return ''
  const withImages = parseObsidianImages(note.value.content)
  const { titleMap, suffixMap } = wikiLinkMap.value
  const withWikiLinks = parseWikiLinks(withImages, titleMap, suffixMap)
  const withVimeo = parseVimeoTokens(withWikiLinks)
  const withYoutube = parseYoutubeTokens(withVimeo)
  return marked.parse(withYoutube) as string
})

const readingStats = computed(() => {
  if (!note.value?.content) return null
  const text = note.value.content.replace(/[#*`\[\]>_~]/g, '').trim()
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(wordCount / 200))
  return { charCount: text.length, minutes }
})

useHead({
  title: note.value?.title ?? 'Note',
})
</script>

<template>
  <article class="max-w-[960px] mx-auto px-4 py-6 md:px-12 md:py-10">
    <!-- Breadcrumb (shared between note and folder views) -->
    <nav class="flex items-center gap-1 text-[10px] md:text-xs text-vault-muted mb-6 min-w-0">
      <NuxtLink to="/" class="hover:text-vault-text shrink-0">Home</NuxtLink>
      <template v-for="(part, i) in slug.split('/')" :key="i">
        <span class="shrink-0">/</span>
        <NuxtLink
          :to="`/${slug.split('/').slice(0, i + 1).join('/')}`"
          class="hover:text-vault-text capitalize truncate max-w-[120px] md:max-w-none"
        >
          {{ part.replace(/-/g, ' ') }}
        </NuxtLink>
      </template>
    </nav>

    <!-- Note view -->
    <template v-if="note">
      <header class="mb-8 pb-6 border-b border-vault-border">
        <h1 class="text-2xl md:text-3xl font-bold text-vault-text mb-2">{{ note.title }}</h1>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-vault-muted">
          <template v-if="note.showDate !== false">
            <span>Created {{ new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
            <span class="text-vault-border">·</span>
            <span>Updated {{ new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
            <span class="text-vault-border">·</span>
          </template>
          <template v-if="readingStats">
            <span>{{ readingStats.charCount.toLocaleString() }} characters</span>
            <span class="text-vault-border">·</span>
            <span>{{ readingStats.minutes }} min read</span>
          </template>
        </div>
      </header>

      <div class="prose prose-vault max-w-none" v-html="renderedContent" />

      <div class="mt-12 pt-6 border-t border-vault-border">
        <NuxtLink
          :to="`/admin?edit=${note.slug}`"
          class="text-xs text-vault-muted hover:text-vault-accent"
        >
          Edit this note →
        </NuxtLink>
      </div>
    </template>

    <!-- Folder index view -->
    <template v-else-if="folderNode">
      <header class="mb-8 pb-6 border-b border-vault-border">
        <h1 class="text-2xl md:text-3xl font-bold text-vault-text">{{ folderNode.title }}</h1>
      </header>

      <ul class="space-y-1">
        <li v-for="child in folderNode.children" :key="child.slug">
          <NuxtLink
            :to="`/${child.slug}`"
            class="flex items-center gap-3 px-3 py-2 rounded hover:bg-vault-surface/50 text-vault-text hover:text-vault-accent group"
          >
            <FolderIcon v-if="!child.path" :size="15" class="shrink-0 text-vault-muted group-hover:text-vault-accent" />
            <FileTextIcon v-else :size="15" class="shrink-0 text-vault-muted group-hover:text-vault-accent" />
            <span class="text-sm">{{ child.title }}</span>
            <span v-if="!child.path" class="text-xs text-vault-muted/60">({{ child.children.length }})</span>
          </NuxtLink>
        </li>
      </ul>
    </template>
  </article>
</template>

<style>
/* Internal WikiLink styling */
.prose a.internal-link {
  @apply text-vault-accent border-vault-accent;
}

/* Code block overrides */
.prose pre {
  @apply bg-vault-sidebar border border-vault-border overflow-x-auto;
}

.prose code:not(pre code) {
  @apply bg-vault-surface text-red-400 px-1 py-0.5 rounded text-[0.85em];
}

/* Blockquote */
.prose blockquote {
  @apply border-l-4 border-vault-accent text-vault-muted bg-vault-surface/30 rounded-r;
}

/* Table — scrollable wrapper so wide tables don't push the page */
.prose table {
  @apply block overflow-x-auto;
}
.prose table th {
  @apply bg-vault-surface text-vault-text border-vault-border;
}
.prose table td {
  @apply border-vault-border;
}
</style>
