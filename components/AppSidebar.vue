<script setup lang="ts">
import type { NavNode } from '~/server/api/navigation.get'

const { data: nav } = await useFetch<NavNode[]>('/api/navigation', { key: 'nav' })
</script>

<template>
  <aside class="w-[280px] shrink-0 bg-vault-sidebar border-r border-vault-border flex flex-col overflow-hidden">
    <!-- Brand -->
    <div class="px-4 py-4 border-b border-vault-border">
      <NuxtLink to="/" class="font-semibold text-vault-text text-sm tracking-wide hover:text-vault-accent">
        Cogitations
      </NuxtLink>
    </div>

    <!-- Nav tree -->
    <nav class="flex-1 overflow-y-auto py-2 px-2">
      <template v-if="nav && nav.length">
        <SidebarNode v-for="node in nav" :key="node.slug" :node="node" />
      </template>
      <p v-else class="text-vault-muted text-xs px-2 py-4">No notes published yet.</p>
    </nav>
  </aside>
</template>
