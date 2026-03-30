<script setup lang="ts">
const emit = defineEmits<{ select: [slug: string] }>()

interface NoteRow { title: string; slug: string; is_published: number }

const { data: notes, refresh } = await useFetch<NoteRow[]>('/api/admin/list')

const deleting = ref<string | null>(null)

async function deleteNote(slug: string) {
  if (!confirm(`Unpublish "${slug}"?`)) return
  deleting.value = slug
  await $fetch(`/api/admin/notes/${slug}`, { method: 'DELETE' }).catch(() => null)
  deleting.value = null
  await refresh()
}
</script>

<template>
  <ul class="space-y-0.5">
    <li
      v-for="note in notes"
      :key="note.slug"
      class="flex items-center gap-1 group rounded"
    >
      <button
        class="flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-vault-surface truncate"
        :class="note.is_published ? 'text-vault-text' : 'text-vault-muted line-through'"
        @click="emit('select', note.slug)"
      >
        {{ note.title || note.slug }}
      </button>
      <button
        class="opacity-0 group-hover:opacity-100 text-vault-muted hover:text-red-400 px-1 text-xs"
        title="Unpublish"
        :disabled="deleting === note.slug"
        @click.stop="deleteNote(note.slug)"
      >
        ✕
      </button>
    </li>
    <li v-if="!notes?.length" class="text-vault-muted text-xs px-2 py-2">No notes yet.</li>
  </ul>
</template>
