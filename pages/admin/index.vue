<script setup lang="ts">
import { marked } from 'marked'
import type { NavNode } from '~/server/api/navigation.get'

definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

const route = useRoute()
const router = useRouter()

// ── Note form state ─────────────────────────────────────────────────────────
const editSlug = ref((route.query.edit as string) ?? '')
const title = ref('')
const slug = ref('')
const parentPath = ref('/')
const content = ref('')
const isPublished = ref(true)
const showDate = ref(true)
const createdAt = ref('')
const sortOrder = ref<number | null>(500)
const saving = ref(false)
const saveStatus = ref<'idle' | 'saved' | 'error'>('idle')
const errorMsg = ref('')
const sidebarRefresh = ref(0)

const isNewNote = computed(() => !editSlug.value)

// ── Folder paths for parent picker ──────────────────────────────────────────
const { data: folderPaths, refresh: refreshFolderPaths } = await useFetch<string[]>('/api/admin/folder-paths')

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// Auto-generate slug from title (only for new notes)
watch(title, (t) => {
  if (!editSlug.value) {
    slug.value = t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100)
  }
})

function resetForm() {
  title.value = ''
  slug.value = ''
  parentPath.value = '/'
  content.value = ''
  isPublished.value = true
  showDate.value = true
  createdAt.value = todayIso()
  sortOrder.value = 500
  saveStatus.value = 'idle'
}

watchEffect(async () => {
  if (!editSlug.value) {
    resetForm()
    return
  }
  const data = await $fetch<{ title: string; slug: string; parentPath: string; isPublished: boolean; createdAt: string; content: string; sortOrder: number | null; showDate: boolean }>(
    `/api/admin/notes/${editSlug.value}`,
  ).catch(() => null)
  if (data) {
    title.value = data.title
    slug.value = data.slug
    parentPath.value = data.parentPath
    isPublished.value = data.isPublished !== false
    createdAt.value = data.createdAt ? data.createdAt.slice(0, 10) : todayIso()
    sortOrder.value = data.sortOrder ?? null
    showDate.value = data.showDate !== false
    content.value = data.content
  }
})

async function save() {
  saving.value = true
  saveStatus.value = 'idle'
  errorMsg.value = ''
  try {
    await $fetch('/api/admin/notes', {
      method: 'POST',
      body: {
        title: title.value,
        slug: slug.value,
        parent_path: parentPath.value,
        content: content.value,
        is_published: isPublished.value,
        show_date: showDate.value,
        created_at: createdAt.value || undefined,
        sort_order: sortOrder.value,
      },
    })
    saveStatus.value = 'saved'
    editSlug.value = slug.value
    router.replace({ query: { edit: slug.value } })
    sidebarRefresh.value++
    refreshFolderPaths()
    setTimeout(() => { saveStatus.value = 'idle' }, 3000)
  } catch (e: unknown) {
    saveStatus.value = 'error'
    errorMsg.value = (e as { data?: { message?: string } })?.data?.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

// ── Delete page ──────────────────────────────────────────────────────────────
async function deletePage() {
  if (!confirm(`Delete "${title.value}" permanently? This cannot be undone.`)) return
  await $fetch(`/api/admin/notes/${editSlug.value}`, { method: 'DELETE', query: { hard: 'true' } })
  editSlug.value = ''
  router.replace({ query: {} })
  resetForm()
  sidebarRefresh.value++
}

// ── Editor controls ──────────────────────────────────────────────────────────
const FONT_SIZES = ['0.75rem', '0.875rem', '1rem', '1.125rem'] as const
const fontSizeStep = ref(1)
const fontSize = computed(() => FONT_SIZES[fontSizeStep.value])
const lineWrap = ref(true)

const externalCursorPos = ref<number | null>(null)
const selectionMeta = ref<{ from: number; to: number; empty: boolean } | null>(null)
const selectedText = ref<string | null>(null)

function onSelectionChange(payload: { text: string } | null) {
  selectedText.value = payload?.text ?? null
}

function onSelectionMeta(payload: { from: number; to: number; empty: boolean }) {
  selectionMeta.value = payload
}

// ── Layout ───────────────────────────────────────────────────────────────────
type LayoutMode = 'oneThird' | 'equal' | 'twoThirds'
const layoutMode = ref<LayoutMode>('equal')

const splitStyle = computed(() => {
  const map: Record<LayoutMode, string> = {
    oneThird: '1fr 2fr',
    equal: '1fr 1fr',
    twoThirds: '2fr 1fr',
  }
  return { gridTemplateColumns: map[layoutMode.value] }
})

// ── Right pane (preview / AI) ─────────────────────────────────────────────────
type RightPane = 'preview' | 'ai'
const rightPane = ref<RightPane>('preview')

// ── Preview ──────────────────────────────────────────────────────────────────
// Nav tree for WikiLink resolution
const { data: navTree } = await useFetch<NavNode[]>('/api/navigation', { key: 'admin-nav' })

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

const renderer = new marked.Renderer()
renderer.link = (href: string, title: string | null | undefined, text: string) => {
  if (!href) return text
  const isExternal = href.startsWith('http') || href.startsWith('mailto')
  const titleAttr = title ? ` title="${title}"` : ''
  const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${href}"${titleAttr}${target}>${text}</a>`
}
marked.use({ renderer })

function parseObsidianImages(src: string): string {
  return src.replace(/!\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, imgPath, alt) => {
    const filename = imgPath.split('/').pop() ?? imgPath
    return `![${alt?.trim() || ''}](/api/images/images/${filename})`
  })
}

function parseWikiLinks(src: string, titleMap: Map<string, string>, suffixMap: Map<string, string>): string {
  return src.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_, linkPath, alias) => {
    const display = alias || linkPath
    const slugified = linkPath.toLowerCase().replace(/[^a-z0-9/]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const resolved = titleMap.get(linkPath.toLowerCase()) ?? suffixMap.get(slugified)
    const href = resolved ? `/${resolved}` : `/${slugified}`
    return `[${display}](${href})`
  })
}

const previewHtml = computed(() => {
  if (!content.value) return ''
  const withImages = parseObsidianImages(content.value)
  const { titleMap, suffixMap } = wikiLinkMap.value
  const withWikiLinks = parseWikiLinks(withImages, titleMap, suffixMap)
  return marked.parse(withWikiLinks) as string
})

// ── AI assistant ─────────────────────────────────────────────────────────────
const aiPrompt = ref('')
const aiAnswer = ref('')
const aiAsking = ref(false)
const aiError = ref('')
const aiPromptExpanded = ref(true)
const selectedAiText = ref('')
const aiResultEl = ref<HTMLElement | null>(null)

const aiAnswerHtml = computed(() => aiAnswer.value ? marked.parse(aiAnswer.value) as string : '')

async function askAi() {
  if (!aiPrompt.value.trim() || aiAsking.value) return
  aiAsking.value = true
  aiAnswer.value = ''
  aiError.value = ''
  selectedAiText.value = ''

  const hasSelection = !!(selectedText.value?.trim())
  const readingNote = `\n\n[Current note content]\n---\n${content.value}\n---\n`
  const selectionNote = hasSelection
    ? `\n[Selected text — focus your response on this]\n---\n${selectedText.value}\n---\n${readingNote}`
    : readingNote

  const fullPrompt = `${aiPrompt.value.trim()}${selectionNote}
[Instructions]
Respond with only the markdown text. Do not explain what you did, do not add introductory sentences, and do not wrap the result in backticks.`

  try {
    const response = await fetch('/api/admin/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: fullPrompt }),
    })

    if (!response.ok || !response.body) {
      const err = await response.json().catch(() => ({})) as { message?: string }
      aiError.value = err.message ?? 'AI request failed'
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') continue
        try {
          const parsed = JSON.parse(jsonStr)
          const txt = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          if (txt) aiAnswer.value += txt as string
        } catch { /* ignore malformed chunks */ }
      }
    }
  } catch {
    aiError.value = 'AI request failed. Please try again.'
  } finally {
    aiAsking.value = false
    if (aiAnswer.value) aiPromptExpanded.value = false
  }
}

function insertAiResultAtCursor() {
  if (!aiAnswer.value) return
  const snippet = selectedAiText.value || aiAnswer.value
  const current = content.value ?? ''
  const pos = selectionMeta.value?.from ?? current.length
  const before = current.slice(0, pos)
  const after = current.slice(selectionMeta.value?.to ?? pos)
  const prefix = before && !before.endsWith('\n') ? '\n' : ''
  const suffix = after && !after.startsWith('\n') ? '\n' : ''
  content.value = before + prefix + snippet + suffix + after
  externalCursorPos.value = before.length + prefix.length + snippet.length
}

function replaceSelectionWithAiResult() {
  if (!aiAnswer.value || !selectionMeta.value || selectionMeta.value.empty) return
  const snippet = selectedAiText.value || aiAnswer.value
  const current = content.value ?? ''
  const { from, to } = selectionMeta.value
  content.value = current.slice(0, from) + snippet + current.slice(to)
  externalCursorPos.value = from + snippet.length
}

function replaceAllWithAiResult() {
  if (!aiAnswer.value) return
  content.value = aiAnswer.value
  externalCursorPos.value = 0
}

function reformatAndGrammar() {
  rightPane.value = 'ai'
  aiPromptExpanded.value = true
  aiAnswer.value = ''
  aiError.value = ''
  aiPrompt.value = 'Fix all spelling mistakes, grammar errors, and formatting issues in this note. Correct punctuation, capitalization, and paragraph structure where needed. Do not change the meaning, content, or structure — only fix errors and clean up the text.'
  askAi()
}

// Track AI result pane text selection
if (process.client) {
  const handleAiSelection = () => {
    if (!aiResultEl.value) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !aiResultEl.value.contains(sel.anchorNode)) {
      selectedAiText.value = ''
      return
    }
    selectedAiText.value = sel.toString().trim()
  }
  onMounted(() => document.addEventListener('selectionchange', handleAiSelection))
  onBeforeUnmount(() => document.removeEventListener('selectionchange', handleAiSelection))
}

// ── Image panel ───────────────────────────────────────────────────────────────
const showImagePanel = ref(false)
type ImageTab = 'upload' | 'unsplash'
const imageTab = ref<ImageTab>('upload')
const imageWidthPct = ref<number | null>(null)

// Upload tab
const imageFileInput = ref<HTMLInputElement | null>(null)
const uploadPreviewUrl = ref('')
const uploadedUrl = ref('')
const uploadAlt = ref('')
const uploadStatus = ref('')
const uploading = ref(false)

function resizeImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

async function handleImageFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  uploadStatus.value = 'Processing…'
  uploadPreviewUrl.value = ''
  uploadedUrl.value = ''

  let dataUrl: string
  try {
    dataUrl = await resizeImageToDataUrl(file, 1024, 0.85)
  } catch {
    uploadStatus.value = 'Failed to process image'
    return
  }

  uploadPreviewUrl.value = dataUrl
  uploadAlt.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  uploadStatus.value = 'Uploading…'
  uploading.value = true

  try {
    // Convert data URL back to Blob → File for FormData upload
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const resizedFile = new File([blob], file.name, { type: blob.type })
    const form = new FormData()
    form.append('file', resizedFile)
    const result = await $fetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: form })
    uploadedUrl.value = result.url
    uploadStatus.value = ''
  } catch {
    uploadStatus.value = 'Upload failed. Please try again.'
  } finally {
    uploading.value = false
  }
}

function buildImageMarkdown(url: string, alt: string): string {
  const altText = alt.trim() || 'image'
  if (imageWidthPct.value !== null && imageWidthPct.value > 0 && imageWidthPct.value < 100) {
    return `<img src="${url}" alt="${altText}" style="width: ${imageWidthPct.value}%; display: block; margin: 0 auto;" />`
  }
  return `![${altText}](${url})`
}

function insertImage(url: string, alt: string) {
  const token = buildImageMarkdown(url, alt)
  const current = content.value ?? ''
  const pos = selectionMeta.value?.from ?? current.length
  const end = selectionMeta.value?.to ?? pos
  const before = current.slice(0, pos)
  const after = current.slice(end)
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  content.value = before + prefix + token + suffix + after
  externalCursorPos.value = before.length + prefix.length + token.length
  showImagePanel.value = false
}

// Unsplash tab
interface UnsplashPhoto {
  id: string
  altDescription: string
  thumbUrl: string
  regularUrl: string
  downloadLocation: string
  photographerName: string
  photographerUrl: string
}
const unsplashQuery = ref('')
const unsplashSearching = ref(false)
const unsplashResults = ref<UnsplashPhoto[]>([])
const unsplashSelected = ref<UnsplashPhoto | null>(null)
const unsplashAlt = ref('')
const unsplashError = ref('')
const unsplashSaving = ref(false)
const unsplashSaveError = ref('')

async function searchUnsplash() {
  if (!unsplashQuery.value.trim() || unsplashSearching.value) return
  unsplashSearching.value = true
  unsplashError.value = ''
  unsplashResults.value = []
  unsplashSelected.value = null
  try {
    unsplashResults.value = await $fetch<UnsplashPhoto[]>('/api/admin/unsplash-search', {
      query: { q: unsplashQuery.value.trim() },
    })
  } catch (e: unknown) {
    unsplashError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Search failed. Check your UNSPLASH_ACCESS_KEY.'
  } finally {
    unsplashSearching.value = false
  }
}

watch(unsplashSelected, (photo) => {
  if (photo) unsplashAlt.value = photo.altDescription
})

async function saveUnsplashImage() {
  if (!unsplashSelected.value || unsplashSaving.value) return
  unsplashSaving.value = true
  unsplashSaveError.value = ''
  try {
    const result = await $fetch<{ url: string }>('/api/admin/unsplash-save', {
      method: 'POST',
      body: {
        regularUrl: unsplashSelected.value.regularUrl,
        downloadLocation: unsplashSelected.value.downloadLocation,
        altDescription: unsplashAlt.value,
      },
    })
    const photoUrl = `${unsplashSelected.value.photographerUrl}?utm_source=cogitations&utm_medium=referral`
    const unsplashUrl = 'https://unsplash.com?utm_source=cogitations&utm_medium=referral'
    const attribution = `*Photo by [${unsplashSelected.value.photographerName}](${photoUrl}) on [Unsplash](${unsplashUrl})*`
    const token = `${buildImageMarkdown(result.url, unsplashAlt.value)}\n${attribution}`

    const current = content.value ?? ''
    const pos = selectionMeta.value?.from ?? current.length
    const end = selectionMeta.value?.to ?? pos
    const before = current.slice(0, pos)
    const after = current.slice(end)
    const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
    content.value = before + prefix + token + suffix + after
    externalCursorPos.value = before.length + prefix.length + token.length
    showImagePanel.value = false
  } catch (e: unknown) {
    unsplashSaveError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to save image'
  } finally {
    unsplashSaving.value = false
  }
}

watch(showImagePanel, (open) => {
  if (!open) {
    uploadPreviewUrl.value = ''
    uploadedUrl.value = ''
    uploadAlt.value = ''
    uploadStatus.value = ''
    uploading.value = false
    unsplashQuery.value = ''
    unsplashResults.value = []
    unsplashSelected.value = null
    unsplashAlt.value = ''
    unsplashError.value = ''
    unsplashSaveError.value = ''
    imageWidthPct.value = null
  }
})
</script>

<template>
  <div class="flex h-[calc(100vh-3rem)] overflow-hidden">

    <!-- ── Note list sidebar ──────────────────────────────────────────────── -->
    <aside class="w-64 shrink-0 flex flex-col border-r border-vault-border bg-vault-sidebar">

      <!-- New note button -->
      <div class="p-3 border-b border-vault-border shrink-0">
        <button
          class="w-full text-left text-xs px-3 py-2 rounded font-semibold transition-colors"
          :class="isNewNote
            ? 'bg-vault-accent text-white ring-2 ring-vault-accent/40'
            : 'bg-vault-accent/80 text-white hover:bg-vault-accent'"
          @click="editSlug = ''; router.replace({ query: {} })"
        >
          + New Note
        </button>
      </div>

      <!-- Note tree with search -->
      <div class="flex-1 overflow-hidden flex flex-col p-2">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-vault-faint px-1 mb-1.5">Notes</p>
        <AdminNoteList
          :current-slug="editSlug"
          :refresh-trigger="sidebarRefresh"
          @select="editSlug = $event; router.replace({ query: { edit: $event } })"
        />
      </div>
    </aside>

    <!-- ── Editor area ────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">

      <!-- New note guidance banner -->
      <div
        v-if="isNewNote"
        class="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-vault-accent/10 border-b border-vault-accent/20 text-xs text-vault-accent"
      >
        <span class="font-bold text-[10px] uppercase tracking-widest bg-vault-accent text-white px-1.5 py-0.5 rounded shrink-0">New Note</span>
        <span class="text-vault-accent/80">Enter a title below, write your content in the editor, then click <strong>Save</strong>.</span>
      </div>

      <!-- ── Title + primary actions bar ──────────────────────────────────── -->
      <div class="flex items-center gap-4 px-5 py-3 border-b border-vault-border bg-vault-sidebar shrink-0">
        <!-- Mode badge (editing only) -->
        <span
          v-if="!isNewNote"
          class="text-[10px] font-semibold uppercase tracking-widest text-vault-faint bg-vault-surface px-2 py-0.5 rounded-full shrink-0 select-none"
        >Editing</span>

        <!-- Title input -->
        <input
          v-model="title"
          type="text"
          placeholder="Note title…"
          class="flex-1 bg-transparent text-sm font-semibold text-vault-text placeholder:text-vault-muted outline-none min-w-0"
        />

        <!-- Actions group -->
        <div class="flex items-center gap-3 shrink-0">
          <!-- Published toggle -->
          <label class="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input v-model="isPublished" type="checkbox" class="accent-vault-accent w-3.5 h-3.5" />
            <span :class="isPublished ? 'text-vault-text font-medium' : 'text-vault-faint'">Published</span>
          </label>

          <div class="w-px h-4 bg-vault-border shrink-0" />

          <!-- View link styled as ghost button -->
          <NuxtLink
            v-if="editSlug"
            :to="`/${editSlug}`"
            target="_blank"
            class="inline-flex items-center gap-1 text-xs text-vault-muted hover:text-vault-accent border border-vault-border hover:border-vault-accent rounded-md px-3 py-1.5 transition-colors font-medium"
          >
            View <span class="opacity-60 text-[10px]">↗</span>
          </NuxtLink>

          <!-- Delete button (danger, outlined) -->
          <button
            v-if="!isNewNote"
            class="text-xs px-3 py-1.5 rounded-md font-medium transition-colors border border-red-300 text-red-400 hover:bg-red-50 hover:border-red-400"
            @click="deletePage"
          >
            Delete
          </button>

          <!-- Save button (primary) -->
          <button
            class="text-xs px-5 py-1.5 rounded-md font-semibold transition-colors shadow-sm"
            :class="saving
              ? 'bg-vault-muted text-white cursor-not-allowed opacity-60'
              : 'bg-vault-accent text-white hover:bg-vault-accent-hover'"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- ── Metadata row ───────────────────────────────────────────────── -->
      <div class="flex items-center gap-5 px-5 py-2 border-b border-vault-border bg-vault-sidebar/40 shrink-0 flex-wrap">
        <label class="flex items-center gap-2 text-xs">
          <span class="text-vault-faint font-medium select-none">Slug</span>
          <input
            v-model="slug"
            type="text"
            class="bg-vault-bg border border-vault-border rounded-md px-2.5 py-1 text-vault-text outline-none text-xs w-56 focus:border-vault-accent transition-colors"
            placeholder="folder/note-name"
          />
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-vault-faint font-medium select-none">Parent</span>
          <input
            v-model="parentPath"
            type="text"
            list="folder-paths-list"
            class="bg-vault-bg border border-vault-border rounded-md px-2.5 py-1 text-vault-text outline-none text-xs w-36 focus:border-vault-accent transition-colors"
            placeholder="/"
          />
          <datalist id="folder-paths-list">
            <option v-for="p in folderPaths" :key="p" :value="p" />
          </datalist>
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-vault-faint font-medium select-none">Created</span>
          <input
            v-model="createdAt"
            type="date"
            class="bg-vault-bg border border-vault-border rounded-md px-2.5 py-1 text-vault-text outline-none text-xs focus:border-vault-accent transition-colors"
          />
        </label>
        <label class="flex items-center gap-2 text-xs">
          <span class="text-vault-faint font-medium select-none">Order</span>
          <input
            :value="sortOrder ?? ''"
            type="number"
            placeholder="—"
            class="bg-vault-bg border border-vault-border rounded-md px-2.5 py-1 text-vault-text outline-none text-xs w-16 focus:border-vault-accent transition-colors"
            @input="sortOrder = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input v-model="showDate" type="checkbox" class="accent-vault-accent w-3.5 h-3.5" />
          <span class="text-vault-faint font-medium">Show date</span>
        </label>
      </div>

      <!-- ── Editor controls row ────────────────────────────────────────── -->
      <div class="flex items-center gap-3 px-5 py-2 border-b border-vault-border bg-vault-bg shrink-0 flex-wrap">

        <!-- Layout segmented control -->
        <div class="flex items-center gap-0 border border-vault-border rounded-md overflow-hidden">
          <button
            v-for="[mode, label] in [['oneThird','1/3–2/3'], ['equal','1/2–1/2'], ['twoThirds','2/3–1/3']] as [typeof layoutMode, string][]"
            :key="mode"
            class="px-2.5 py-1 text-xs font-medium transition-colors border-r border-vault-border last:border-r-0"
            :class="layoutMode === mode
              ? 'bg-vault-accent text-white'
              : 'text-vault-muted hover:bg-vault-surface bg-transparent'"
            @click="layoutMode = mode"
          >
            {{ label }}
          </button>
        </div>

        <div class="w-px h-4 bg-vault-border shrink-0" />

        <!-- Font size segmented control -->
        <div class="flex items-center gap-0 border border-vault-border rounded-md overflow-hidden">
          <button
            class="px-2.5 py-1 text-xs font-medium text-vault-muted hover:bg-vault-surface transition-colors"
            title="Decrease font size"
            @click="fontSizeStep = Math.max(0, fontSizeStep - 1)"
          >A−</button>
          <button
            class="px-2.5 py-1 text-xs font-medium text-vault-muted hover:bg-vault-surface transition-colors border-l border-vault-border"
            title="Increase font size"
            @click="fontSizeStep = Math.min(FONT_SIZES.length - 1, fontSizeStep + 1)"
          >A+</button>
        </div>

        <div class="w-px h-4 bg-vault-border shrink-0" />

        <!-- Wrap toggle -->
        <button
          class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
          :class="lineWrap
            ? 'border-vault-accent/40 bg-vault-accent/10 text-vault-accent'
            : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
          @click="lineWrap = !lineWrap"
        >
          Wrap
        </button>

        <!-- Image panel toggle -->
        <button
          class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
          :class="showImagePanel
            ? 'border-vault-accent/40 bg-vault-accent/10 text-vault-accent'
            : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
          @click="showImagePanel = !showImagePanel"
        >
          Image
        </button>

        <!-- Reformat / grammar -->
        <button
          class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
          :class="aiAsking
            ? 'border-vault-border text-vault-faint cursor-not-allowed opacity-50'
            : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
          :disabled="aiAsking || !content"
          title="Fix spelling, grammar, and formatting with AI"
          @click="reformatAndGrammar"
        >
          {{ aiAsking && rightPane === 'ai' ? 'Checking…' : 'Reformat / Grammar' }}
        </button>

        <!-- Right-pane segmented control (pushed to end) -->
        <div class="ml-auto flex items-center gap-0 border border-vault-border rounded-md overflow-hidden">
          <button
            class="px-3.5 py-1 text-xs font-medium transition-colors"
            :class="rightPane === 'preview' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
            @click="rightPane = 'preview'"
          >Preview</button>
          <button
            class="px-3.5 py-1 text-xs font-medium transition-colors border-l border-vault-border"
            :class="rightPane === 'ai' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
            @click="rightPane = 'ai'"
          >AI</button>
        </div>
      </div>

      <!-- Image panel (collapsible) -->
      <div
        v-if="showImagePanel"
        class="shrink-0 border-b border-vault-border bg-vault-sidebar/20 p-3 space-y-3 max-h-80 overflow-y-auto"
      >
        <!-- Tabs + shared width control -->
        <div class="flex items-center justify-between">
          <div class="flex gap-1 rounded border border-vault-border overflow-hidden">
            <button
              class="px-3 py-1 text-xs font-medium transition-colors"
              :class="imageTab === 'upload' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
              @click="imageTab = 'upload'"
            >Upload</button>
            <button
              class="px-3 py-1 text-xs font-medium transition-colors border-l border-vault-border"
              :class="imageTab === 'unsplash' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
              @click="imageTab = 'unsplash'"
            >Unsplash</button>
          </div>
          <label class="flex items-center gap-1.5 text-xs text-vault-muted">
            Width %:
            <input
              v-model.number="imageWidthPct"
              type="number"
              min="10"
              max="99"
              placeholder="100%"
              class="w-20 rounded border border-vault-border bg-vault-bg px-2 py-0.5 text-xs outline-none"
            />
            <button v-if="imageWidthPct !== null" class="text-vault-faint hover:text-vault-muted" @click="imageWidthPct = null">✕</button>
          </label>
        </div>

        <!-- Upload tab -->
        <template v-if="imageTab === 'upload'">
          <input ref="imageFileInput" type="file" accept="image/*" class="hidden" @change="handleImageFile" />
          <button
            class="text-xs px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface"
            @click="imageFileInput?.click()"
          >
            Choose image file…
          </button>
          <p v-if="uploadStatus" class="text-xs text-vault-muted">{{ uploadStatus }}</p>
          <template v-if="uploadPreviewUrl">
            <div class="relative inline-block">
              <img :src="uploadPreviewUrl" alt="Preview" class="max-h-32 rounded border border-vault-border object-contain" :class="uploading ? 'opacity-50' : ''" />
              <span v-if="uploading" class="absolute inset-0 flex items-center justify-center text-xs text-vault-muted">Uploading…</span>
            </div>
            <label class="flex items-center gap-1.5 text-xs text-vault-muted">
              Alt text:
              <input
                v-model="uploadAlt"
                type="text"
                placeholder="Describe the image…"
                class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-0.5 text-xs outline-none"
              />
            </label>
            <button
              class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
              :disabled="uploading || !uploadedUrl"
              @click="insertImage(uploadedUrl, uploadAlt)"
            >
              Insert image
            </button>
          </template>
        </template>

        <!-- Unsplash tab -->
        <template v-else-if="imageTab === 'unsplash'">
          <div class="flex gap-2">
            <input
              v-model="unsplashQuery"
              type="text"
              placeholder="Search Unsplash…"
              class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs outline-none"
              :disabled="unsplashSearching"
              @keydown.enter.prevent="searchUnsplash"
            />
            <button
              class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
              :disabled="unsplashSearching || !unsplashQuery.trim()"
              @click="searchUnsplash"
            >
              {{ unsplashSearching ? 'Searching…' : 'Search' }}
            </button>
          </div>
          <p v-if="unsplashError" class="text-xs text-red-500">{{ unsplashError }}</p>

          <div v-if="unsplashResults.length" class="grid grid-cols-6 gap-1.5">
            <button
              v-for="photo in unsplashResults"
              :key="photo.id"
              class="relative aspect-square overflow-hidden rounded border-2 transition-colors"
              :class="unsplashSelected?.id === photo.id ? 'border-vault-accent' : 'border-transparent hover:border-vault-faint'"
              :title="photo.altDescription"
              @click="unsplashSelected = photo"
            >
              <img :src="photo.thumbUrl" :alt="photo.altDescription" class="h-full w-full object-cover" />
            </button>
          </div>

          <template v-if="unsplashSelected">
            <div class="flex items-start gap-3 rounded border border-vault-border bg-vault-bg p-2">
              <img :src="unsplashSelected.thumbUrl" alt="" class="h-16 w-16 shrink-0 rounded object-cover" />
              <div class="flex-1 space-y-1.5">
                <p class="text-[10px] text-vault-muted">
                  By <a :href="`${unsplashSelected.photographerUrl}?utm_source=cogitations&utm_medium=referral`" target="_blank" class="underline">{{ unsplashSelected.photographerName }}</a>
                  on <a href="https://unsplash.com?utm_source=cogitations&utm_medium=referral" target="_blank" class="underline">Unsplash</a>
                </p>
                <input
                  v-model="unsplashAlt"
                  type="text"
                  placeholder="Alt text…"
                  class="w-full rounded border border-vault-border bg-vault-surface px-2 py-0.5 text-xs outline-none"
                />
                <button
                  class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                  :disabled="unsplashSaving"
                  @click="saveUnsplashImage"
                >
                  {{ unsplashSaving ? 'Saving…' : 'Insert image' }}
                </button>
                <p v-if="unsplashSaveError" class="text-xs text-red-500">{{ unsplashSaveError }}</p>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- ── Split pane ─────────────────────────────────────────────────── -->
      <div class="flex-1 grid min-h-0 overflow-hidden" :style="splitStyle">

        <!-- Left: CodeMirror editor -->
        <div class="flex flex-col overflow-hidden border-r border-vault-border">
          <MarkdownEditor
            v-model="content"
            :external-cursor-pos="externalCursorPos ?? undefined"
            :font-size="fontSize"
            :line-wrap="lineWrap"
            class="flex-1 min-h-0"
            @selection-change="onSelectionChange"
            @selection-meta="onSelectionMeta"
          />
        </div>

        <!-- Right: preview or AI -->
        <div class="flex flex-col overflow-hidden">

          <!-- Preview pane -->
          <div
            v-if="rightPane === 'preview'"
            class="flex-1 overflow-y-auto px-8 py-6 prose prose-vault max-w-none"
            v-html="previewHtml"
          />

          <!-- AI pane -->
          <div v-else class="flex-1 flex flex-col gap-3 overflow-y-auto p-4">

            <!-- Prompt section -->
            <div
              class="rounded border border-vault-border bg-vault-sidebar/50 transition-all"
              :class="aiAnswer && !aiPromptExpanded ? 'p-2' : 'p-3'"
            >
              <!-- Collapsed: one-line summary -->
              <template v-if="aiAnswer && !aiPromptExpanded">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-medium text-vault-muted shrink-0">Prompt</span>
                  <p class="min-w-0 flex-1 truncate text-xs text-vault-text" :title="aiPrompt">{{ aiPrompt || '—' }}</p>
                  <div class="flex gap-1 shrink-0">
                    <button
                      class="text-xs px-2 py-0.5 rounded border border-vault-border text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                      :disabled="aiAsking || !aiPrompt.trim()"
                      @click="askAi"
                    >{{ aiAsking ? 'Asking…' : 'Ask again' }}</button>
                    <button
                      class="text-xs px-2 py-0.5 rounded border border-vault-border text-vault-muted hover:bg-vault-surface"
                      @click="aiPromptExpanded = true"
                    >Expand</button>
                  </div>
                </div>
                <p v-if="aiError" class="mt-1 text-xs text-red-500">{{ aiError }}</p>
              </template>

              <!-- Expanded: full prompt area -->
              <template v-else>
                <label class="mb-1 block text-xs font-medium text-vault-muted">AI prompt</label>
                <textarea
                  v-model="aiPrompt"
                  :rows="aiAnswer ? 3 : 5"
                  placeholder="Ask AI for help with this note…&#10;&#10;Your selected text + current content are included as context."
                  class="w-full resize-none rounded border border-vault-border bg-vault-bg px-3 py-2 text-xs text-vault-text outline-none placeholder:text-vault-faint"
                  :disabled="aiAsking"
                />
                <p class="mt-1 text-[11px] text-vault-faint">
                  {{ selectedText ? 'AI will focus on your selected text.' : 'Full note content is sent as context.' }}
                </p>
                <div class="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                    :disabled="aiAsking || !aiPrompt.trim()"
                    @click="askAi"
                  >{{ aiAsking ? 'Asking…' : 'Ask AI' }}</button>
                  <button
                    v-if="aiPrompt"
                    class="text-xs px-2 py-1 rounded border border-vault-border text-vault-faint hover:bg-vault-surface"
                    :disabled="aiAsking"
                    @click="aiPrompt = ''"
                  >Clear</button>
                  <button
                    v-if="aiAnswer"
                    class="text-xs px-2 py-1 rounded border border-vault-border text-vault-faint hover:bg-vault-surface"
                    @click="aiPromptExpanded = false"
                  >Collapse</button>
                  <p v-if="aiError" class="text-xs text-red-500">{{ aiError }}</p>
                </div>
              </template>
            </div>

            <!-- AI result -->
            <div
              ref="aiResultEl"
              class="flex-1 overflow-y-auto rounded border border-vault-border bg-vault-sidebar/30 p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-vault-muted">Result</p>
                <div class="flex gap-1 flex-wrap">
                  <button
                    class="text-xs px-2 py-0.5 rounded border border-vault-border text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                    :disabled="!aiAnswer || !selectionMeta || selectionMeta.empty"
                    @click="replaceSelectionWithAiResult"
                  >{{ selectedAiText ? 'Replace with selection' : 'Replace selection' }}</button>
                  <button
                    class="text-xs px-2 py-0.5 rounded border border-vault-border text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                    :disabled="!aiAnswer"
                    @click="insertAiResultAtCursor"
                  >{{ selectedAiText ? 'Insert selection' : 'Insert at cursor' }}</button>
                  <button
                    class="text-xs px-3 py-0.5 rounded border font-semibold disabled:opacity-40 transition-colors"
                    :class="aiAnswer ? 'border-vault-accent bg-vault-accent text-white hover:bg-vault-accent-hover' : 'border-vault-border text-vault-faint'"
                    :disabled="!aiAnswer"
                    title="Replace entire note content with this result"
                    @click="replaceAllWithAiResult"
                  >Replace page</button>
                </div>
              </div>

              <!-- Thinking indicator -->
              <div v-if="aiAsking" class="flex items-center gap-2 py-4">
                <span class="text-xs text-vault-muted italic">Thinking</span>
                <span class="flex gap-1">
                  <span class="h-1.5 w-1.5 rounded-full bg-vault-faint animate-bounce [animation-delay:-0.3s]" />
                  <span class="h-1.5 w-1.5 rounded-full bg-vault-faint animate-bounce [animation-delay:-0.15s]" />
                  <span class="h-1.5 w-1.5 rounded-full bg-vault-faint animate-bounce" />
                </span>
              </div>

              <div
                v-else-if="aiAnswer"
                class="prose prose-vault prose-sm max-w-none text-xs"
                v-html="aiAnswerHtml"
              />
              <p v-else class="text-xs text-vault-faint">
                Ask a question above — the AI will respond here.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Bottom save bar ───────────────────────────────────────────────── -->
      <div class="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-t border-vault-border bg-vault-sidebar/50">
        <span class="text-xs text-vault-faint truncate">
          <template v-if="isNewNote">New note — not yet saved</template>
          <template v-else>/{{ editSlug }}</template>
        </span>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="saveStatus === 'saved'" class="text-xs text-green-600">✓ Saved</span>
          <span v-if="saveStatus === 'error'" class="text-xs text-red-500">✗ {{ errorMsg }}</span>
          <button
            class="text-xs px-4 py-1.5 rounded font-semibold transition-colors"
            :class="saving
              ? 'bg-vault-muted text-white cursor-not-allowed opacity-60'
              : 'bg-vault-accent text-white hover:bg-vault-accent-hover'"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
