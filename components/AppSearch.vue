<script setup lang="ts">
import { SearchIcon } from 'lucide-vue-next'

const query = ref('')
const open = ref(false)
const results = ref<{ title: string; slug: string; content_preview: string }[]>([])
let timer: ReturnType<typeof setTimeout>

function debounce(fn: () => void, delay: number) {
  clearTimeout(timer)
  timer = setTimeout(fn, delay)
}

watch(query, (q) => {
  open.value = q.length > 0
  debounce(async () => {
    if (q.length < 2) { results.value = []; return }
    results.value = await $fetch<typeof results.value>('/api/search', { query: { q } })
  }, 300)
})

function close() {
  open.value = false
  query.value = ''
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-2 bg-vault-surface border border-vault-border rounded px-2 py-1">
      <SearchIcon :size="12" class="text-vault-muted shrink-0" />
      <input
        v-model="query"
        type="text"
        placeholder="Search site..."
        class="bg-transparent text-xs text-vault-text placeholder:text-vault-muted outline-none w-full"
        @focus="open = query.length > 0"
        @blur="setTimeout(close, 200)"
      />
    </div>

    <div
      v-if="open && results.length"
      class="absolute top-full mt-1 left-0 right-0 bg-vault-surface border border-vault-border rounded shadow-xl z-50 max-h-80 overflow-y-auto"
    >
      <NuxtLink
        v-for="r in results"
        :key="r.slug"
        :to="`/${r.slug}`"
        class="block px-3 py-2 hover:bg-vault-sidebar border-b border-vault-border/50 last:border-0"
        @click="close"
      >
        <p class="text-xs font-medium text-vault-text">{{ r.title }}</p>
        <p class="text-xs text-vault-muted truncate mt-0.5">{{ r.content_preview }}</p>
      </NuxtLink>
    </div>

    <div
      v-else-if="open && query.length >= 2"
      class="absolute top-full mt-1 left-0 right-0 bg-vault-surface border border-vault-border rounded px-3 py-2 text-xs text-vault-muted z-50"
    >
      No results for "{{ query }}"
    </div>
  </div>
</template>
