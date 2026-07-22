<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import type { NavNode } from '~/server/api/navigation.get'

const props = defineProps<{ node: NavNode; depth?: number }>()
const depth = computed(() => props.depth ?? 0)
// Virtual folders start collapsed; real note nodes start expanded
const open = ref(!!props.node.path)

const route = useRoute()
const nodePath = computed(() => props.node.path || `/${props.node.slug}`)
const isActive = computed(() => route.path === nodePath.value)
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 rounded cursor-pointer group border-l-2"
      :style="{ paddingLeft: `${8 + depth * 16}px` }"
      :class="[
        'py-2 md:py-1 pr-2',
        isActive ? 'bg-vault-surface text-vault-accent border-vault-accent' : 'text-vault-text hover:bg-vault-surface/50 border-transparent',
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

      <!-- Virtual folder: clickable link to folder index -->
      <NuxtLink
        v-if="!node.path"
        :to="`/${node.slug}`"
        class="flex-1 text-sm truncate py-0.5 font-semibold text-vault-muted"
      >
        {{ node.title }}
        <span class="text-vault-muted/60 font-normal">({{ node.children.length }})</span>
      </NuxtLink>
      <NuxtLink v-else :to="node.path" class="flex-1 text-sm truncate py-0.5">
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
