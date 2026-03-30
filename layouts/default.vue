<script setup lang="ts">
import { PanelLeftIcon } from 'lucide-vue-next'

const sidebarOpen = ref(true)
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-vault-bg">
    <!-- Sidebar -->
    <AppSidebar v-if="sidebarOpen" />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top bar -->
      <header class="h-[50px] flex items-center px-4 border-b border-vault-border bg-vault-sidebar shrink-0">
        <button
          class="text-vault-muted hover:text-vault-text mr-3"
          title="Toggle sidebar"
          @click="sidebarOpen = !sidebarOpen"
        >
          <PanelLeftIcon :size="16" />
        </button>
        <AppSearch class="flex-1 max-w-md" />
        <NuxtLink
          to="/admin"
          class="ml-auto text-xs text-vault-muted hover:text-vault-accent px-2 py-1 rounded"
        >
          Admin
        </NuxtLink>
      </header>

      <!-- Page slot -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
