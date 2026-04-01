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
// ── Site configuration ───────────────────────────────────────────────────────
interface AdminSiteConfig {
  siteTitle: string; siteTagline: string; siteLogoKey: string
  copyrightNotice: string; authorName: string; authorEmail: string
  twitterUrl: string; githubUrl: string; linkedinUrl: string; mastodonUrl: string
  ogImageUrl: string; faviconUrl: string; robotsMeta: string
  analyticsId: string; unsplashAttributionSource: string; homePage: string
}
// Shared with admin layout — layout's "Site Settings" button sets this to true
const showConfigPanel = useState('adminShowConfigPanel', () => false)

// Open settings panel when navigated here with ?settings=1 from another admin page
if (route.query.settings) {
  showConfigPanel.value = true
  router.replace({ query: editSlug.value ? { edit: editSlug.value } : {} })
}
const configForm = ref<AdminSiteConfig | null>(null)
const configSaving = ref(false)
const configSaveStatus = ref<'idle' | 'saved' | 'error'>('idle')
const configSaveError = ref('')
const logoUploading = ref(false)
const logoUploadStatus = ref('')
const logoPreviewUrl = ref('')

const { data: fullConfig, refresh: refreshConfig } = await useFetch<AdminSiteConfig>('/api/admin/config', { key: 'admin-config' })
watchEffect(() => {
  if (fullConfig.value && !configForm.value) {
    configForm.value = { ...fullConfig.value }
    if (fullConfig.value.siteLogoKey) {
      logoPreviewUrl.value = `/api/images/${fullConfig.value.siteLogoKey}`
    }
  }
})

async function saveConfig() {
  if (!configForm.value) return
  configSaving.value = true
  configSaveStatus.value = 'idle'
  configSaveError.value = ''
  try {
    await $fetch('/api/admin/config', { method: 'PUT', body: configForm.value })
    configSaveStatus.value = 'saved'
    const fresh = await $fetch<AdminSiteConfig>('/api/config')
    const sc = useSiteConfig()
    sc.value = {
      siteTitle: fresh.siteTitle, siteTagline: fresh.siteTagline, siteLogoKey: fresh.siteLogoKey,
      copyrightNotice: fresh.copyrightNotice, authorName: fresh.authorName,
      twitterUrl: fresh.twitterUrl, githubUrl: fresh.githubUrl, linkedinUrl: fresh.linkedinUrl,
      mastodonUrl: fresh.mastodonUrl, ogImageUrl: fresh.ogImageUrl, faviconUrl: fresh.faviconUrl,
      robotsMeta: fresh.robotsMeta, homePage: fresh.homePage,
    }
    setTimeout(() => { configSaveStatus.value = 'idle' }, 3000)
  } catch (e: unknown) {
    configSaveStatus.value = 'error'
    configSaveError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Save failed'
  } finally {
    configSaving.value = false
  }
}

async function handleLogoFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !configForm.value) return
  input.value = ''
  logoUploadStatus.value = 'Uploading…'
  logoUploading.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const result = await $fetch<{ url: string; key: string }>('/api/admin/upload', { method: 'POST', body: form })
    configForm.value.siteLogoKey = result.key
    logoPreviewUrl.value = result.url
    logoUploadStatus.value = ''
  } catch {
    logoUploadStatus.value = 'Upload failed. Please try again.'
  } finally {
    logoUploading.value = false
  }
}

function removeLogo() {
  if (!configForm.value) return
  configForm.value.siteLogoKey = ''
  logoPreviewUrl.value = ''
}


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

const previewHtml = computed(() => {
  if (!content.value) return ''
  const withImages = parseObsidianImages(content.value)
  const { titleMap, suffixMap } = wikiLinkMap.value
  const withWikiLinks = parseWikiLinks(withImages, titleMap, suffixMap)
  const withVimeo = parseVimeoTokens(withWikiLinks)
  const withYoutube = parseYoutubeTokens(withVimeo)
  return marked.parse(withYoutube) as string
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
type ImageTab = 'upload' | 'ai' | 'unsplash'
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
    const utmSource = configForm.value?.unsplashAttributionSource || 'blog'
    const photoUrl = `${unsplashSelected.value.photographerUrl}?utm_source=${utmSource}&utm_medium=referral`
    const unsplashUrl = `https://unsplash.com?utm_source=${utmSource}&utm_medium=referral`
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

function toggleImagePanel() {
  showVimeoPanel.value = false
  showImagePanel.value = !showImagePanel.value
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
    aiImagePrompt.value = ''
    aiImageRefinePrompt.value = ''
    aiImageHistory.value = []
    aiImageAlt.value = ''
    aiImageError.value = ''
  }
})

// ── AI image generation ───────────────────────────────────────────────────────
interface AiImageItem { prompt: string; url: string; mimeType: string; rawData: string }
const aiImagePrompt = ref('')
const aiImageRefinePrompt = ref('')
const aiImageGenerating = ref(false)
const aiImageHistory = ref<AiImageItem[]>([])
const aiImageAlt = ref('')
const aiImageError = ref('')

const aiImageCurrent = computed(() => aiImageHistory.value[aiImageHistory.value.length - 1] ?? null)

async function generateAiImage() {
  if (!aiImagePrompt.value.trim() || aiImageGenerating.value) return
  aiImageGenerating.value = true
  aiImageError.value = ''
  try {
    const result = await $fetch<{ url: string; mimeType: string; data: string }>(
      '/api/admin/generate-image',
      { method: 'POST', body: { prompt: aiImagePrompt.value.trim() } },
    )
    aiImageHistory.value.push({ prompt: aiImagePrompt.value.trim(), url: result.url, mimeType: result.mimeType, rawData: result.data })
    if (!aiImageAlt.value) aiImageAlt.value = aiImagePrompt.value.trim().slice(0, 80)
  } catch (e: unknown) {
    aiImageError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Image generation failed'
  } finally {
    aiImageGenerating.value = false
  }
}

async function refineAiImage() {
  if (!aiImageRefinePrompt.value.trim() || aiImageGenerating.value || !aiImageCurrent.value) return
  aiImageGenerating.value = true
  aiImageError.value = ''
  const prev = aiImageCurrent.value
  try {
    const result = await $fetch<{ url: string; mimeType: string; data: string }>(
      '/api/admin/generate-image',
      {
        method: 'POST',
        body: {
          prompt: aiImageRefinePrompt.value.trim(),
          previousPrompt: prev.prompt,
          previousImage: { mimeType: prev.mimeType, data: prev.rawData },
        },
      },
    )
    aiImageHistory.value.push({ prompt: aiImageRefinePrompt.value.trim(), url: result.url, mimeType: result.mimeType, rawData: result.data })
    aiImageRefinePrompt.value = ''
  } catch (e: unknown) {
    aiImageError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Refinement failed'
  } finally {
    aiImageGenerating.value = false
  }
}

function selectAiHistoryItem(index: number) {
  const item = aiImageHistory.value.splice(index, 1)[0]
  aiImageHistory.value.push(item)
}

function resetAiImage() {
  aiImageHistory.value = []
  aiImagePrompt.value = ''
  aiImageRefinePrompt.value = ''
  aiImageAlt.value = ''
  aiImageError.value = ''
}

// ── Video panel (Vimeo + YouTube) ────────────────────────────────────────────
const showVimeoPanel = ref(false)
type VideoPlatform = 'vimeo' | 'youtube'
const videoPlatform = ref<VideoPlatform>('vimeo')

// Vimeo state
const vimeoRef = ref('')
const vimeoId = ref('')
const vimeoHash = ref('')
const vimeoCurrentTime = ref(0)
const vimeoStartSeconds = ref<number | null>(null)
const vimeoEndSeconds = ref<number | null>(null)
const vimeoLoading = ref(false)
const vimeoStatus = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vimeoPlayer: any = null

// YouTube state
const youtubeRef = ref('')
const youtubeId = ref('')
const youtubeStartSeconds = ref<number | null>(null)
const youtubeEndSeconds = ref<number | null>(null)
const youtubeStatus = ref('')

function toggleVimeoPanel() {
  showImagePanel.value = false
  showVimeoPanel.value = !showVimeoPanel.value
}

watch(showVimeoPanel, (open) => {
  if (!open) {
    videoPlatform.value = 'vimeo'
    vimeoPlayer?.destroy()
    vimeoPlayer = null
    vimeoRef.value = ''
    vimeoId.value = ''
    vimeoHash.value = ''
    vimeoCurrentTime.value = 0
    vimeoStartSeconds.value = null
    vimeoEndSeconds.value = null
    vimeoLoading.value = false
    vimeoStatus.value = ''
    youtubeRef.value = ''
    youtubeId.value = ''
    youtubeStartSeconds.value = null
    youtubeEndSeconds.value = null
    youtubeStatus.value = ''
  }
})

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function parseVimeoInput(raw: string): { id: string; hash: string } {
  const trimmed = raw.trim()
  // Plain numeric ID
  if (/^\d{6,}$/.test(trimmed)) return { id: trimmed, hash: '' }
  // https://vimeo.com/ID or https://vimeo.com/ID/HASH or https://vimeo.com/channels/xxx/ID
  const match = trimmed.match(/vimeo\.com\/(?:.*\/)?(\d{6,})(?:\/([a-zA-Z0-9]+))?/)
  if (match) return { id: match[1], hash: match[2] ?? '' }
  return { id: '', hash: '' }
}

async function resolveVimeo() {
  const { id, hash } = parseVimeoInput(vimeoRef.value)
  if (!id) { vimeoStatus.value = 'Could not parse Vimeo URL or ID'; return }
  vimeoLoading.value = true
  vimeoStatus.value = ''
  vimeoPlayer?.destroy()
  vimeoPlayer = null
  vimeoId.value = id
  vimeoHash.value = hash
  vimeoCurrentTime.value = 0

  await nextTick()
  try {
    const VimeoPlayer = (await import('@vimeo/player')).default
    const iframe = document.getElementById('vimeo-preview-frame') as HTMLIFrameElement | null
    if (!iframe) { vimeoStatus.value = 'Preview frame not found'; return }
    vimeoPlayer = new VimeoPlayer(iframe)
    vimeoPlayer.on('timeupdate', ({ seconds }: { seconds: number }) => {
      vimeoCurrentTime.value = seconds
    })
  } catch {
    vimeoStatus.value = 'Failed to load Vimeo player'
  } finally {
    vimeoLoading.value = false
  }
}

function setStartFromPlayer() { vimeoStartSeconds.value = Math.floor(vimeoCurrentTime.value) }
function setEndFromPlayer() { vimeoEndSeconds.value = Math.floor(vimeoCurrentTime.value) }

function insertVimeoToken() {
  if (!vimeoId.value) return
  const id = vimeoId.value
  const hash = vimeoHash.value
  const start = vimeoStartSeconds.value
  const end = vimeoEndSeconds.value

  let token: string
  if (start !== null || end !== null) {
    token = `{{vimeo:${id}:${hash}:${start ?? ''}:${end ?? ''}}}`
  } else if (hash) {
    token = `{{vimeo:${id}:${hash}}}`
  } else {
    token = `{{vimeo:${id}}}`
  }

  const current = content.value ?? ''
  const pos = selectionMeta.value?.from ?? current.length
  const before = current.slice(0, pos)
  const after = current.slice(pos)
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  content.value = before + prefix + token + suffix + after
  externalCursorPos.value = before.length + prefix.length + token.length
  showVimeoPanel.value = false
  vimeoStatus.value = 'Inserted!'
}

function parseYoutubeInput(raw: string): { id: string } {
  const trimmed = raw.trim()
  // Plain 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return { id: trimmed }
  // https://www.youtube.com/watch?v=ID, https://youtu.be/ID, https://www.youtube.com/embed/ID
  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match) return { id: match[1] }
  return { id: '' }
}

function resolveYoutube() {
  const { id } = parseYoutubeInput(youtubeRef.value)
  if (!id) { youtubeStatus.value = 'Could not parse YouTube URL or ID'; return }
  youtubeId.value = id
  youtubeStartSeconds.value = null
  youtubeEndSeconds.value = null
  youtubeStatus.value = ''
}

function insertYoutubeToken() {
  if (!youtubeId.value) return
  const id = youtubeId.value
  const start = youtubeStartSeconds.value
  const end = youtubeEndSeconds.value

  let token: string
  if (start !== null || end !== null) {
    token = `{{youtube:${id}:${start ?? ''}:${end ?? ''}}}`
  } else {
    token = `{{youtube:${id}}}`
  }

  const current = content.value ?? ''
  const pos = selectionMeta.value?.from ?? current.length
  const before = current.slice(0, pos)
  const after = current.slice(pos)
  const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
  content.value = before + prefix + token + suffix + after
  externalCursorPos.value = before.length + prefix.length + token.length
  showVimeoPanel.value = false
}
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
            :to="isPublished ? `/${editSlug}` : '/home'"
            target="_blank"
            class="inline-flex items-center gap-1 text-xs border rounded-md px-3 py-1.5 transition-colors font-medium"
            :class="isPublished
              ? 'text-vault-muted hover:text-vault-accent border-vault-border hover:border-vault-accent'
              : 'text-vault-faint border-vault-border cursor-not-allowed opacity-50'"
            :title="isPublished ? undefined : 'Page is unpublished — opening home instead'"
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

          <div class="w-px h-4 bg-vault-border shrink-0" />

          <!-- Save status + button -->
          <span v-if="saveStatus === 'saved'" class="text-xs text-green-600 shrink-0">Saved</span>
          <span v-if="saveStatus === 'error'" class="text-xs text-red-500 shrink-0">{{ errorMsg }}</span>
          <button
            class="text-xs px-5 py-1.5 rounded-md font-semibold transition-colors shadow-sm shrink-0"
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
          @click="toggleImagePanel"
        >
          Image
        </button>

        <!-- Video panel toggle -->
        <button
          class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
          :class="showVimeoPanel
            ? 'border-vault-accent/40 bg-vault-accent/10 text-vault-accent'
            : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
          @click="toggleVimeoPanel"
        >
          Video
        </button>

        <!-- Grammar & Style -->
        <button
          class="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
          :class="aiAsking
            ? 'border-vault-border text-vault-faint cursor-not-allowed opacity-50'
            : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
          :disabled="aiAsking || !content"
          title="Fix spelling, grammar, and formatting with AI"
          @click="reformatAndGrammar"
        >
          {{ aiAsking && rightPane === 'ai' ? 'Checking…' : 'Grammar & Style' }}
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
              :class="imageTab === 'ai' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
              @click="imageTab = 'ai'"
            >AI</button>
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
          <div class="flex items-center gap-3">
            <button
              class="text-xs px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface shrink-0"
              @click="imageFileInput?.click()"
            >
              Choose image file…
            </button>
            <p v-if="uploadStatus" class="text-xs text-vault-muted">{{ uploadStatus }}</p>
          </div>
          <div v-if="uploadPreviewUrl" class="flex gap-3 items-start">
            <div class="relative shrink-0">
              <img :src="uploadPreviewUrl" alt="Preview" class="h-24 w-24 rounded border border-vault-border object-cover" :class="uploading ? 'opacity-50' : ''" />
              <span v-if="uploading" class="absolute inset-0 flex items-center justify-center text-xs text-vault-muted">Uploading…</span>
            </div>
            <div class="flex flex-col gap-2 text-xs flex-1 min-w-0">
              <label class="flex items-center gap-1.5 text-vault-muted">
                Alt:
                <input
                  v-model="uploadAlt"
                  type="text"
                  placeholder="Describe the image…"
                  class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-0.5 text-xs outline-none min-w-0"
                />
              </label>
              <button
                class="text-xs px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40 self-start"
                :disabled="uploading || !uploadedUrl"
                @click="insertImage(uploadedUrl, uploadAlt)"
              >
                Insert image
              </button>
            </div>
          </div>
        </template>

        <!-- AI image tab -->
        <template v-else-if="imageTab === 'ai'">
          <!-- Phase 1: no history yet -->
          <template v-if="!aiImageHistory.length">
            <textarea
              v-model="aiImagePrompt"
              rows="3"
              placeholder="Describe the image you want to generate…"
              class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1.5 text-xs outline-none resize-none"
              :disabled="aiImageGenerating"
            />
            <button
              class="text-xs px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
              :disabled="aiImageGenerating || !aiImagePrompt.trim()"
              @click="generateAiImage"
            >
              {{ aiImageGenerating ? 'Generating…' : 'Generate' }}
            </button>
            <p v-if="aiImageError" class="text-xs text-red-500">{{ aiImageError }}</p>
          </template>

          <!-- Phase 2: has history (current image + refinement) -->
          <template v-else>
            <div class="flex gap-3">
              <!-- Current image preview -->
              <img
                v-if="aiImageCurrent"
                :src="aiImageCurrent.url"
                alt="Generated image"
                class="h-24 w-24 rounded border border-vault-border object-cover shrink-0"
              />
              <div class="flex-1 space-y-2 min-w-0">
                <!-- History strip -->
                <div class="flex gap-1 flex-wrap">
                  <button
                    v-for="(item, i) in aiImageHistory"
                    :key="i"
                    class="text-[10px] px-2 py-0.5 rounded border transition-colors"
                    :class="i === aiImageHistory.length - 1
                      ? 'border-vault-accent bg-vault-accent/10 text-vault-accent'
                      : 'border-vault-border text-vault-muted hover:bg-vault-surface'"
                    :title="item.prompt"
                    @click="selectAiHistoryItem(i)"
                  >v{{ i + 1 }}</button>
                </div>
                <!-- Alt text -->
                <label class="flex items-center gap-1.5 text-xs text-vault-muted">
                  Alt:
                  <input
                    v-model="aiImageAlt"
                    type="text"
                    placeholder="Alt text…"
                    class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-0.5 text-xs outline-none"
                  />
                </label>
                <!-- Insert button -->
                <button
                  class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface"
                  @click="aiImageCurrent && insertImage(aiImageCurrent.url, aiImageAlt)"
                >
                  Insert image
                </button>
              </div>
            </div>
            <!-- Refinement -->
            <div class="flex gap-2">
              <input
                v-model="aiImageRefinePrompt"
                type="text"
                placeholder="Describe changes to refine…"
                class="flex-1 rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs outline-none"
                :disabled="aiImageGenerating"
                @keydown.enter.prevent="refineAiImage"
              />
              <button
                class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                :disabled="aiImageGenerating || !aiImageRefinePrompt.trim()"
                @click="refineAiImage"
              >
                {{ aiImageGenerating ? 'Refining…' : 'Refine' }}
              </button>
            </div>
            <p v-if="aiImageError" class="text-xs text-red-500">{{ aiImageError }}</p>
            <button class="text-xs text-vault-faint hover:text-vault-muted" @click="resetAiImage">Start over</button>
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

          <div v-if="unsplashResults.length" class="max-h-24 overflow-y-auto">
            <div class="grid grid-cols-6 gap-1.5">
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
          </div>

          <template v-if="unsplashSelected">
            <div class="flex items-start gap-3 rounded border border-vault-border bg-vault-bg p-2">
              <img :src="unsplashSelected.thumbUrl" alt="" class="h-16 w-16 shrink-0 rounded object-cover" />
              <div class="flex-1 space-y-1.5">
                <p class="text-[10px] text-vault-muted">
                  By <a :href="`${unsplashSelected.photographerUrl}?utm_source=${configForm?.unsplashAttributionSource || 'blog'}&utm_medium=referral`" target="_blank" class="underline">{{ unsplashSelected.photographerName }}</a>
                  on <a :href="`https://unsplash.com?utm_source=${configForm?.unsplashAttributionSource || 'blog'}&utm_medium=referral`" target="_blank" class="underline">Unsplash</a>
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

      <!-- Video panel (collapsible) -->
      <div
        v-if="showVimeoPanel"
        class="shrink-0 border-b border-vault-border bg-vault-sidebar/20 p-3 space-y-3 max-h-96 overflow-y-auto"
      >
        <!-- Platform selector -->
        <div class="flex gap-1 rounded border border-vault-border overflow-hidden w-fit">
          <button
            class="px-3 py-1 text-xs font-medium transition-colors"
            :class="videoPlatform === 'vimeo' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
            @click="videoPlatform = 'vimeo'"
          >Vimeo</button>
          <button
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-vault-border"
            :class="videoPlatform === 'youtube' ? 'bg-vault-accent text-white' : 'text-vault-muted hover:bg-vault-surface'"
            @click="videoPlatform = 'youtube'"
          >YouTube</button>
        </div>

        <!-- ── Vimeo ── -->
        <template v-if="videoPlatform === 'vimeo'">
          <div class="flex gap-2">
            <input
              v-model="vimeoRef"
              type="text"
              placeholder="Vimeo URL or video ID…"
              class="w-[500px] rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs outline-none"
              :disabled="vimeoLoading"
              @keydown.enter.prevent="resolveVimeo"
            />
            <button
              class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
              :disabled="vimeoLoading || !vimeoRef.trim()"
              @click="resolveVimeo"
            >
              {{ vimeoLoading ? 'Loading…' : 'Load Preview' }}
            </button>
          </div>

          <div v-if="vimeoId" class="flex gap-4 items-start">
            <!-- Preview -->
            <div class="aspect-video w-56 shrink-0 rounded overflow-hidden border border-vault-border">
              <iframe
                id="vimeo-preview-frame"
                :src="`https://player.vimeo.com/video/${vimeoId}${vimeoHash ? '?h=' + vimeoHash : ''}`"
                class="h-full w-full"
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
              />
            </div>
            <!-- Controls -->
            <div class="flex flex-col gap-2 text-xs">
              <p class="text-vault-muted">Current: {{ formatSeconds(vimeoCurrentTime) }}</p>
              <div class="flex flex-wrap gap-2 items-center">
                <label class="flex items-center gap-1 text-vault-muted">
                  Start (s):
                  <input
                    type="number"
                    :value="vimeoStartSeconds ?? ''"
                    min="0"
                    class="w-14 rounded border border-vault-border bg-vault-bg px-1.5 py-0.5 text-xs outline-none ml-1"
                    @input="vimeoStartSeconds = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <button class="px-2 py-0.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface" @click="setStartFromPlayer">Set</button>
                <button v-if="vimeoStartSeconds !== null" class="text-vault-faint hover:text-vault-muted" @click="vimeoStartSeconds = null">✕</button>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <label class="flex items-center gap-1 text-vault-muted">
                  End (s):
                  <input
                    type="number"
                    :value="vimeoEndSeconds ?? ''"
                    min="0"
                    class="w-14 rounded border border-vault-border bg-vault-bg px-1.5 py-0.5 text-xs outline-none ml-1"
                    @input="vimeoEndSeconds = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <button class="px-2 py-0.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface" @click="setEndFromPlayer">Set</button>
                <button v-if="vimeoEndSeconds !== null" class="text-vault-faint hover:text-vault-muted" @click="vimeoEndSeconds = null">✕</button>
              </div>
              <p v-if="vimeoStartSeconds !== null || vimeoEndSeconds !== null" class="text-vault-muted">
                Clip: {{ formatSeconds(vimeoStartSeconds ?? 0) }} – {{ vimeoEndSeconds !== null ? formatSeconds(vimeoEndSeconds) : 'end' }}
              </p>
              <div class="flex items-center gap-2 mt-1">
                <button
                  class="px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
                  :disabled="!vimeoId"
                  @click="insertVimeoToken"
                >Insert video</button>
                <span v-if="vimeoStatus" class="text-vault-muted">{{ vimeoStatus }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ── YouTube ── -->
        <template v-else>
          <div class="flex gap-2">
            <input
              v-model="youtubeRef"
              type="text"
              placeholder="YouTube URL or video ID…"
              class="w-[500px] rounded border border-vault-border bg-vault-bg px-2 py-1 text-xs outline-none"
              @keydown.enter.prevent="resolveYoutube"
            />
            <button
              class="text-xs px-3 py-1 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface disabled:opacity-40"
              :disabled="!youtubeRef.trim()"
              @click="resolveYoutube"
            >Load Preview</button>
          </div>
          <p v-if="youtubeStatus && !youtubeId" class="text-xs text-red-500">{{ youtubeStatus }}</p>

          <div v-if="youtubeId" class="flex gap-4 items-start">
            <!-- Preview -->
            <div class="aspect-video w-56 shrink-0 rounded overflow-hidden border border-vault-border">
              <iframe
                :src="`https://www.youtube.com/embed/${youtubeId}`"
                class="h-full w-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
            </div>
            <!-- Controls -->
            <div class="flex flex-col gap-2 text-xs">
              <div class="flex flex-wrap gap-2 items-center">
                <label class="flex items-center gap-1 text-vault-muted">
                  Start (s):
                  <input
                    type="number"
                    :value="youtubeStartSeconds ?? ''"
                    min="0"
                    class="w-14 rounded border border-vault-border bg-vault-bg px-1.5 py-0.5 text-xs outline-none ml-1"
                    @input="youtubeStartSeconds = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <button v-if="youtubeStartSeconds !== null" class="text-vault-faint hover:text-vault-muted" @click="youtubeStartSeconds = null">✕</button>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <label class="flex items-center gap-1 text-vault-muted">
                  End (s):
                  <input
                    type="number"
                    :value="youtubeEndSeconds ?? ''"
                    min="0"
                    class="w-14 rounded border border-vault-border bg-vault-bg px-1.5 py-0.5 text-xs outline-none ml-1"
                    @input="youtubeEndSeconds = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <button v-if="youtubeEndSeconds !== null" class="text-vault-faint hover:text-vault-muted" @click="youtubeEndSeconds = null">✕</button>
              </div>
              <p v-if="youtubeStartSeconds !== null || youtubeEndSeconds !== null" class="text-vault-muted">
                Clip: {{ formatSeconds(youtubeStartSeconds ?? 0) }} – {{ youtubeEndSeconds !== null ? formatSeconds(youtubeEndSeconds) : 'end' }}
              </p>
              <button
                class="px-3 py-1.5 rounded border border-vault-border bg-vault-bg text-vault-muted hover:bg-vault-surface mt-1"
                @click="insertYoutubeToken"
              >Insert video</button>
            </div>
          </div>
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

    </div>
  </div>

  <!-- ── Site Configuration Panel ─────────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="showConfigPanel"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4"
      @click.self="showConfigPanel = false"
    >
      <div class="w-full max-w-2xl bg-vault-bg border border-vault-border rounded-lg shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-vault-border">
          <h2 class="text-sm font-semibold text-vault-text">Site Configuration</h2>
          <button class="text-vault-muted hover:text-vault-text p-1" @click="showConfigPanel = false">✕</button>
        </div>

        <form v-if="configForm" class="p-5 space-y-5" @submit.prevent="saveConfig">

          <!-- Basic Info -->
          <fieldset class="space-y-3">
            <legend class="text-[10px] font-semibold uppercase tracking-wider text-vault-faint mb-2">Basic Info</legend>

            <!-- Logo upload -->
            <div class="flex items-center gap-3">
              <div class="shrink-0">
                <img
                  v-if="logoPreviewUrl"
                  :src="logoPreviewUrl"
                  alt="Site logo"
                  class="h-12 w-12 object-contain rounded border border-vault-border bg-vault-surface"
                />
                <div v-else class="h-12 w-12 rounded border border-dashed border-vault-border bg-vault-surface flex items-center justify-center text-vault-faint text-[10px] text-center leading-tight px-1">
                  No logo
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-vault-faint font-medium">Site Logo</label>
                <div class="flex items-center gap-2">
                  <label class="cursor-pointer text-xs px-3 py-1 rounded border border-vault-border text-vault-muted hover:bg-vault-surface transition-colors">
                    {{ logoUploading ? 'Uploading…' : 'Upload image' }}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      class="hidden"
                      :disabled="logoUploading"
                      @change="handleLogoFile"
                    />
                  </label>
                  <button
                    v-if="configForm.siteLogoKey"
                    type="button"
                    class="text-xs px-2 py-1 rounded border border-vault-border text-vault-muted hover:bg-vault-surface transition-colors"
                    @click="removeLogo"
                  >Remove</button>
                </div>
                <p v-if="logoUploadStatus" class="text-[10px] text-red-500">{{ logoUploadStatus }}</p>
                <p class="text-[10px] text-vault-faint">Displayed to the left of the site title. jpeg, png, gif, webp, svg accepted.</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs col-span-2">
                <span class="text-vault-faint font-medium">Website Title *</span>
                <input v-model="configForm.siteTitle" type="text" required class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs col-span-2">
                <span class="text-vault-faint font-medium">Tagline / Description</span>
                <input v-model="configForm.siteTagline" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="A personal knowledge base" />
              </label>
              <label class="flex flex-col gap-1 text-xs col-span-2">
                <span class="text-vault-faint font-medium">Home Page</span>
                <input v-model="configForm.homePage" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="/home" />
                <span class="text-vault-faint text-[10px]">Path of the note to use as the site home page (e.g. /home or /welcome)</span>
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Author Name</span>
                <input v-model="configForm.authorName" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Author Email</span>
                <input v-model="configForm.authorEmail" type="email" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs col-span-2">
                <span class="text-vault-faint font-medium">Copyright Notice</span>
                <input v-model="configForm.copyrightNotice" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="© 2025 Your Name. All rights reserved." />
              </label>
            </div>
          </fieldset>

          <!-- Social Links -->
          <fieldset class="space-y-3">
            <legend class="text-[10px] font-semibold uppercase tracking-wider text-vault-faint mb-2">Social Links</legend>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Twitter / X URL</span>
                <input v-model="configForm.twitterUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="https://twitter.com/yourhandle" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">GitHub URL</span>
                <input v-model="configForm.githubUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="https://github.com/yourhandle" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">LinkedIn URL</span>
                <input v-model="configForm.linkedinUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Mastodon URL</span>
                <input v-model="configForm.mastodonUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
            </div>
          </fieldset>

          <!-- SEO & Meta -->
          <fieldset class="space-y-3">
            <legend class="text-[10px] font-semibold uppercase tracking-wider text-vault-faint mb-2">SEO & Meta</legend>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Default og:image URL</span>
                <input v-model="configForm.ogImageUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Favicon URL</span>
                <input v-model="configForm.faviconUrl" type="url" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" />
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Robots Meta</span>
                <select v-model="configForm.robotsMeta" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full">
                  <option value="index,follow">index, follow</option>
                  <option value="noindex,nofollow">noindex, nofollow</option>
                  <option value="noindex,follow">noindex, follow</option>
                  <option value="index,nofollow">index, nofollow</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs">
                <span class="text-vault-faint font-medium">Analytics ID</span>
                <input v-model="configForm.analyticsId" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="Plausible domain or GA ID" />
              </label>
            </div>
          </fieldset>

          <!-- Integrations -->
          <fieldset>
            <legend class="text-[10px] font-semibold uppercase tracking-wider text-vault-faint mb-2">Integrations</legend>
            <label class="flex flex-col gap-1 text-xs">
              <span class="text-vault-faint font-medium">Unsplash Attribution Source</span>
              <input v-model="configForm.unsplashAttributionSource" type="text" class="bg-vault-bg border border-vault-border rounded px-2.5 py-1.5 text-vault-text text-xs outline-none focus:border-vault-accent w-full" placeholder="your-site-slug" />
              <span class="text-[10px] text-vault-faint">Used as utm_source= when attributing Unsplash photos. Use a short slug with no spaces.</span>
            </label>
          </fieldset>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-1 border-t border-vault-border">
            <button
              type="submit"
              class="text-xs px-5 py-1.5 rounded font-semibold transition-colors shadow-sm bg-vault-accent text-white hover:bg-vault-accent-hover disabled:opacity-60"
              :disabled="configSaving"
            >
              {{ configSaving ? 'Saving…' : 'Save Configuration' }}
            </button>
            <span v-if="configSaveStatus === 'saved'" class="text-xs text-green-600">✓ Saved</span>
            <span v-if="configSaveStatus === 'error'" class="text-xs text-red-500">{{ configSaveError }}</span>
            <button
              type="button"
              class="ml-auto text-xs px-3 py-1.5 rounded border border-vault-border text-vault-muted hover:bg-vault-surface transition-colors"
              @click="showConfigPanel = false"
            >
              Close
            </button>
          </div>
        </form>
        <p v-else class="p-5 text-xs text-vault-muted">Loading configuration…</p>
      </div>
    </div>
  </Teleport>
</template>
