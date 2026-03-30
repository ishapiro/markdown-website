<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

// --- State ---
const editSlug = ref((route.query.edit as string) ?? '')
const title = ref('')
const slug = ref('')
const parentPath = ref('/')
const content = ref('')
const isPublished = ref(true)
const saving = ref(false)
const saveStatus = ref<'idle' | 'saved' | 'error'>('idle')
const errorMsg = ref('')

// Load note when editing
watchEffect(async () => {
  if (!editSlug.value) {
    resetForm()
    return
  }
  const data = await $fetch<{ title: string; slug: string; parentPath: string; content: string }>(
    `/api/notes/${editSlug.value}`,
  ).catch(() => null)
  if (data) {
    title.value = data.title
    slug.value = data.slug
    parentPath.value = data.parentPath
    content.value = data.content
  }
})

function resetForm() {
  title.value = ''
  slug.value = ''
  parentPath.value = '/'
  content.value = ''
  isPublished.value = true
  saveStatus.value = 'idle'
}

// Auto-generate slug from title (only when not editing)
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

// --- Save ---
async function save() {
  saving.value = true
  saveStatus.value = 'idle'
  errorMsg.value = ''
  try {
    await $fetch('/api/admin/notes', {
      method: 'POST',
      body: { title: title.value, slug: slug.value, parent_path: parentPath.value, content: content.value, is_published: isPublished.value },
    })
    saveStatus.value = 'saved'
    editSlug.value = slug.value
    router.replace({ query: { edit: slug.value } })
    setTimeout(() => { saveStatus.value = 'idle' }, 3000)
  } catch (e: unknown) {
    saveStatus.value = 'error'
    errorMsg.value = (e as { data?: { message?: string } })?.data?.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

// --- Image upload ---
async function uploadImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const form = new FormData()
  form.append('file', file)
  const res = await $fetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: form })
  content.value += `\n\n![${file.name}](${res.url})`
}
</script>

<template>
  <div class="flex h-[calc(100vh-3rem)]">
    <!-- Left panel: note list -->
    <aside class="w-64 shrink-0 border-r border-vault-border overflow-y-auto bg-vault-sidebar p-3">
      <button
        class="w-full text-left text-xs px-3 py-2 rounded bg-vault-accent text-vault-bg font-semibold mb-3 hover:bg-vault-accent-hover"
        @click="editSlug = ''; router.replace({ query: {} })"
      >
        + New Note
      </button>
      <AdminNoteList @select="editSlug = $event; router.replace({ query: { edit: $event } })" />
    </aside>

    <!-- Right panel: editor -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Editor toolbar -->
      <div class="flex items-center gap-3 px-4 py-2 border-b border-vault-border bg-vault-sidebar shrink-0">
        <input
          v-model="title"
          type="text"
          placeholder="Note title…"
          class="flex-1 bg-transparent text-sm font-semibold text-vault-text placeholder:text-vault-muted outline-none"
        />
        <label class="flex items-center gap-1 text-xs text-vault-muted cursor-pointer">
          <input v-model="isPublished" type="checkbox" class="accent-vault-accent" />
          Published
        </label>
        <label class="text-xs text-vault-muted cursor-pointer hover:text-vault-text">
          📎 Image
          <input type="file" accept="image/*" class="hidden" @change="uploadImage" />
        </label>
        <button
          class="text-xs px-3 py-1.5 rounded font-semibold"
          :class="{
            'bg-vault-accent text-vault-bg hover:bg-vault-accent-hover': !saving,
            'bg-vault-muted text-vault-bg cursor-not-allowed': saving,
          }"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <span v-if="saveStatus === 'saved'" class="text-xs text-green-400">✓ Saved</span>
        <span v-if="saveStatus === 'error'" class="text-xs text-red-400">✗ {{ errorMsg }}</span>
      </div>

      <!-- Slug + parent path -->
      <div class="flex items-center gap-4 px-4 py-1.5 border-b border-vault-border bg-vault-sidebar/50 shrink-0">
        <label class="flex items-center gap-1.5 text-xs text-vault-muted">
          Slug:
          <input
            v-model="slug"
            type="text"
            class="bg-vault-surface rounded px-2 py-0.5 text-vault-text outline-none text-xs w-64"
            placeholder="folder/note-name"
          />
        </label>
        <label class="flex items-center gap-1.5 text-xs text-vault-muted">
          Parent:
          <input
            v-model="parentPath"
            type="text"
            class="bg-vault-surface rounded px-2 py-0.5 text-vault-text outline-none text-xs w-32"
            placeholder="/"
          />
        </label>
        <NuxtLink
          v-if="editSlug"
          :to="`/${editSlug}`"
          target="_blank"
          class="ml-auto text-xs text-vault-link hover:text-vault-accent"
        >
          View →
        </NuxtLink>
      </div>

      <!-- Textarea -->
      <textarea
        v-model="content"
        class="flex-1 bg-vault-bg text-vault-text font-mono text-sm p-4 resize-none outline-none"
        placeholder="Write your Markdown here…&#10;&#10;WikiLinks: [[Note Title]] or [[Path/Note|Display Text]]"
        spellcheck="false"
      />
    </div>
  </div>
</template>
