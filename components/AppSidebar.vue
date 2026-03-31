<script setup lang="ts">
import { XIcon } from 'lucide-vue-next'
import type { NavNode } from '~/server/api/navigation.get'

const emit = defineEmits<{ close: [] }>()
const { data: nav } = await useFetch<NavNode[]>('/api/navigation', { key: 'nav' })
</script>

<template>
  <aside class="w-[280px] shrink-0 bg-vault-sidebar border-r border-vault-border flex flex-col overflow-hidden shadow-xl md:shadow-none h-full">
    <!-- Brand -->
    <div class="px-4 py-4 border-b border-vault-border flex items-center justify-between">
      <NuxtLink to="/" class="font-semibold text-vault-text text-sm tracking-wide hover:text-vault-accent">
        Cogitations
      </NuxtLink>
      <!-- Close button: mobile only -->
      <button
        class="text-vault-muted hover:text-vault-text md:hidden p-1 -mr-1"
        aria-label="Close menu"
        @click="emit('close')"
      >
        <XIcon :size="16" />
      </button>
    </div>

    <!-- Nav tree -->
    <nav class="flex-1 overflow-y-auto py-2 px-2">
      <template v-if="nav && nav.length">
        <SidebarNode v-for="node in nav" :key="node.slug" :node="node" />
      </template>
      <p v-else class="text-vault-muted text-xs px-2 py-4">No posts published yet.</p>
    </nav>
  </aside>
</template>
