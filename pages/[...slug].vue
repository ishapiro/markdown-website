<script setup lang="ts">
import { marked } from 'marked'
import type { NavNode } from '~/server/api/navigation.get'

const route = useRoute()
const slug = computed(() => (route.params.slug as string[]).join('/'))

const [{ data: note, error }, { data: navTree }] = await Promise.all([
  useFetch(`/api/notes/${slug.value}`, { key: `note-${slug.value}` }),
  useFetch<NavNode[]>('/api/navigation', { key: 'navigation' }),
])

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

if (error.value?.statusCode === 404) {
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

const renderedContent = computed(() => {
  if (!note.value?.content) return ''
  const withImages = parseObsidianImages(note.value.content)
  const { titleMap, suffixMap } = wikiLinkMap.value
  const withWikiLinks = parseWikiLinks(withImages, titleMap, suffixMap)
  return marked.parse(withWikiLinks) as string
})

useHead({
  title: note.value?.title ?? 'Note',
})
</script>

<template>
  <article class="max-w-[960px] mx-auto px-12 py-10">
    <template v-if="note">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-1 text-xs text-vault-muted mb-6">
        <NuxtLink to="/" class="hover:text-vault-text">Home</NuxtLink>
        <template v-for="(part, i) in note.slug.split('/')" :key="i">
          <span>/</span>
          <NuxtLink
            :to="`/${note.slug.split('/').slice(0, i + 1).join('/')}`"
            class="hover:text-vault-text capitalize"
          >
            {{ part.replace(/-/g, ' ') }}
          </NuxtLink>
        </template>
      </nav>

      <!-- Note header -->
      <header class="mb-8 pb-6 border-b border-vault-border">
        <h1 class="text-3xl font-bold text-vault-text mb-2">{{ note.title }}</h1>
        <p v-if="note.showDate !== false" class="text-xs text-vault-muted">
          Created {{ new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
          &nbsp;·&nbsp;
          Last updated {{ new Date(note.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </p>
      </header>

      <!-- Content -->
      <div
        class="prose prose-vault max-w-none"
        v-html="renderedContent"
      />

      <!-- Admin edit link -->
      <div class="mt-12 pt-6 border-t border-vault-border">
        <NuxtLink
          :to="`/admin?edit=${note.slug}`"
          class="text-xs text-vault-muted hover:text-vault-accent"
        >
          Edit this note →
        </NuxtLink>
      </div>
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
  @apply bg-vault-sidebar border border-vault-border;
}

.prose code:not(pre code) {
  @apply bg-vault-surface text-red-400 px-1 py-0.5 rounded text-[0.85em];
}

/* Blockquote */
.prose blockquote {
  @apply border-l-4 border-vault-accent text-vault-muted bg-vault-surface/30 rounded-r;
}

/* Table */
.prose table th {
  @apply bg-vault-surface text-vault-text border-vault-border;
}
.prose table td {
  @apply border-vault-border;
}
</style>
