<script setup lang="ts">
import { marked } from 'marked'

const route = useRoute()
const slug = computed(() => (route.params.slug as string[]).join('/'))

const { data: note, error } = await useFetch(`/api/notes/${slug.value}`, {
  key: `note-${slug.value}`,
})

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, message: 'Note not found', fatal: true })
}

// Configure marked for safe rendering
const renderer = new marked.Renderer()

// Override link renderer to open external links in a new tab
renderer.link = ({ href, title, text }: { href?: string | null; title?: string | null; text: string }) => {
  if (!href) return text
  const isExternal = href.startsWith('http') || href.startsWith('mailto')
  const titleAttr = title ? ` title="${title}"` : ''
  const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${href}"${titleAttr}${target}>${text}</a>`
}

marked.use({ renderer })

// Parse WikiLinks: [[Path/To/Note|Display Text]] or [[Note Title]]
function parseWikiLinks(src: string): string {
  return src.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, path, alias) => {
    const slug = path.toLowerCase().replace(/ /g, '-').replace(/\//g, '/')
    const display = alias || path
    return `[${display}](/${slug}){.internal-link}`
  })
}

const renderedContent = computed(() => {
  if (!note.value?.content) return ''
  const withWikiLinks = parseWikiLinks(note.value.content)
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
        <p class="text-xs text-vault-muted">
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
