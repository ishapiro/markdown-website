<template>
  <div class="min-h-screen bg-vault-bg text-vault-text">
    <header class="h-12 flex items-center px-6 border-b border-vault-border bg-vault-sidebar">

      <span class="text-vault-accent font-semibold text-xl shrink-0">{{ siteConfig.siteTitle }}</span>

      <!-- Return to Blog -->
      <NuxtLink to="/home" class="text-xs text-vault-muted hover:text-vault-text ml-4 shrink-0">
        Return to Blog
      </NuxtLink>

      <!-- Primary nav -->
      <nav class="ml-6 flex items-center gap-1">
        <NuxtLink
          to="/admin"
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          active-class="bg-vault-surface text-vault-text"
          :exact="true"
        >
          Content
        </NuxtLink>
        <NuxtLink
          to="/admin/users"
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          active-class="bg-vault-surface text-vault-text"
        >
          Users
        </NuxtLink>
        <NuxtLink
          to="/admin/analytics"
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          active-class="bg-vault-surface text-vault-text"
        >
          Analytics
        </NuxtLink>
      </nav>

      <!-- Right actions -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Rebuild Index -->
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface disabled:opacity-50"
          :disabled="reindexing"
          @click="reindex"
        >
          {{ reindexing ? 'Rebuilding…' : 'Rebuild Index' }}
        </button>
        <span v-if="reindexStatus === 'done'" class="text-xs text-green-600 shrink-0">{{ reindexMsg }}</span>
        <span v-if="reindexStatus === 'error'" class="text-xs text-red-500 shrink-0">{{ reindexMsg }}</span>

        <!-- Site Settings -->
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          @click="showConfigPanel = true"
        >
          Site Settings
        </button>

        <div class="w-px h-4 bg-vault-border shrink-0 mx-1" />

        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          @click="logout"
        >
          Sign Out
        </button>
      </div>

    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
const siteConfig = useSiteConfig()

// Shared state — the Content page (index.vue) reads showConfigPanel to open its settings modal
const showConfigPanel = useState('adminShowConfigPanel', () => false)

const reindexing = ref(false)
const reindexStatus = ref<'idle' | 'done' | 'error'>('idle')
const reindexMsg = ref('')

async function reindex() {
  reindexing.value = true
  reindexStatus.value = 'idle'
  try {
    const result = await $fetch<{ reindexed: number }>('/api/admin/reindex', { method: 'POST' })
    reindexMsg.value = `Reindexed ${result.reindexed} notes`
    reindexStatus.value = 'done'
    setTimeout(() => { reindexStatus.value = 'idle' }, 4000)
  } catch {
    reindexMsg.value = 'Reindex failed'
    reindexStatus.value = 'error'
  } finally {
    reindexing.value = false
  }
}

async function logout() {
  await Promise.allSettled([
    $fetch('/api/admin/logout', { method: 'POST' }),
    $fetch('/api/auth/logout'),
  ])
  await navigateTo('/admin/login')
}
</script>
