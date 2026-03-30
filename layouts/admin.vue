<template>
  <div class="min-h-screen bg-vault-bg text-vault-text">
    <header class="h-12 flex items-center px-6 border-b border-vault-border bg-vault-sidebar">
      <NuxtLink to="/" class="text-vault-muted hover:text-vault-text mr-4">
        <ArrowLeftIcon :size="16" />
      </NuxtLink>
      <span class="text-vault-accent font-semibold text-sm">Cogitations Admin</span>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ArrowLeftIcon } from 'lucide-vue-next'
</script>
