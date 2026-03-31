<script setup lang="ts">
import { MenuIcon, PanelLeftIcon } from 'lucide-vue-next'

const sidebarOpen = ref(false)
const route = useRoute()

onMounted(() => {
  sidebarOpen.value = window.innerWidth >= 768
})

watch(() => route.path, () => {
  if (window.innerWidth < 768) sidebarOpen.value = false
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-vault-bg">
    <!-- Mobile backdrop -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/40 z-20 md:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar: fixed overlay on mobile, static flex item on desktop -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-y-0 left-0 z-30 md:static md:z-auto"
    >
      <AppSidebar @close="sidebarOpen = false" />
    </div>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top bar -->
      <header class="h-[50px] flex items-center px-4 border-b border-vault-border bg-vault-sidebar shrink-0 gap-3">
        <!-- Hamburger on mobile, PanelLeft on desktop -->
        <button
          class="text-vault-muted hover:text-vault-text shrink-0 p-1 -ml-1 flex flex-col items-center gap-0.5 md:flex-row"
          :title="sidebarOpen ? 'Close menu' : 'Open menu'"
          @click="sidebarOpen = !sidebarOpen"
        >
          <MenuIcon :size="18" class="md:hidden" />
          <PanelLeftIcon :size="16" class="hidden md:block" />
          <span class="text-[9px] leading-none tracking-wide uppercase md:hidden">
            {{ sidebarOpen ? 'Close' : 'Browse' }}
          </span>
        </button>

        <!-- Brand name: visible on mobile where sidebar is hidden by default -->
        <NuxtLink
          to="/"
          class="font-semibold text-sm text-vault-text hover:text-vault-accent md:hidden shrink-0"
        >
          Cogitations
        </NuxtLink>

        <!-- Search -->
        <AppSearch class="flex-1 md:max-w-md" />

        <!-- Admin link: desktop only -->
        <NuxtLink
          to="/admin"
          class="ml-auto text-xs text-vault-muted hover:text-vault-accent px-2 py-1 rounded hidden md:block shrink-0"
        >
          Admin
        </NuxtLink>
      </header>

      <!-- Page slot -->
      <main class="flex-1 overflow-y-auto overflow-x-hidden">
        <slot />
      </main>
    </div>
  </div>
</template>
