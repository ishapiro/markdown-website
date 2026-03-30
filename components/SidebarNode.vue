<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import type { NavNode } from '~/server/api/navigation.get'

const props = defineProps<{ node: NavNode; depth?: number }>()
const depth = computed(() => props.depth ?? 0)
// Virtual folders start collapsed; real note nodes start expanded
const open = ref(!!props.node.path)

const route = useRoute()
const isActive = computed(() => route.path === props.node.path)
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 rounded cursor-pointer group"
      :style="{ paddingLeft: `${8 + depth * 12}px` }"
      :class="[
        'py-0.5 pr-2',
        isActive ? 'bg-vault-surface text-vault-accent' : 'text-vault-text hover:bg-vault-surface/50',
      ]"
    >
      <button
        v-if="node.children.length"
        class="text-vault-muted hover:text-vault-text shrink-0"
        @click.stop="open = !open"
      >
        <ChevronRightIcon
          :size="12"
          :class="open ? 'rotate-90' : ''"
          class="transition-transform"
        />
      </button>
      <span v-else class="w-3 shrink-0" />

      <!-- Virtual folder: not clickable, toggle children on click -->
      <span
        v-if="!node.path"
        class="flex-1 text-xs truncate py-0.5 font-semibold text-vault-muted cursor-pointer select-none"
        @click="open = !open"
      >
        {{ node.title }}
        <span class="text-vault-muted/60 font-normal">({{ node.children.length }})</span>
      </span>
      <NuxtLink v-else :to="node.path" class="flex-1 text-xs truncate py-0.5">
        {{ node.title }}
      </NuxtLink>
    </div>

    <div v-if="open && node.children.length">
      <SidebarNode
        v-for="child in node.children"
        :key="child.slug"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
