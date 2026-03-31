<template>
  <div class="min-h-screen bg-vault-bg text-vault-text">
    <header class="h-12 flex items-center px-6 border-b border-vault-border bg-vault-sidebar">
      <NuxtLink to="/home" class="flex items-center gap-1 text-xs text-vault-muted hover:text-vault-text mr-4 shrink-0">
        <ArrowLeftIcon :size="14" />
        <span>Blog</span>
      </NuxtLink>
      <span class="text-vault-accent font-semibold text-sm">{{ siteConfig.siteTitle }} Admin</span>
      <NuxtLink to="/home" class="ml-auto text-xs text-vault-muted hover:text-vault-text mr-3">Home</NuxtLink>
      <button
        class="text-xs text-vault-muted hover:text-vault-text"
        @click="logout"
      >Sign out</button>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon } from 'lucide-vue-next'

const siteConfig = useSiteConfig()

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
  await navigateTo('/admin/login')
}
</script>
