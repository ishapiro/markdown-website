<template>
  <div class="min-h-screen bg-vault-bg text-vault-text">
    <header class="h-12 flex items-center px-6 border-b border-vault-border bg-vault-sidebar">

      <span class="text-vault-accent font-semibold text-xl shrink-0">{{ siteConfig.siteTitle }}</span>

      <!-- Return to Blog -->
      <NuxtLink to="/home" class="text-xs text-vault-muted hover:text-vault-text ml-4 shrink-0">
        Return to Blog
      </NuxtLink>

      <!-- Primary nav (hidden on login / access-denied) -->
      <nav v-if="!isAuthPage" class="ml-6 flex items-center gap-1">
        <NuxtLink
          to="/admin"
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          active-class="bg-vault-surface text-vault-text"
          :exact="true"
        >
          Content
        </NuxtLink>
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          :class="route.path.startsWith('/admin/users')
            ? 'bg-vault-surface text-vault-text'
            : 'text-vault-muted hover:text-vault-text hover:bg-vault-surface'"
          @click="adminOnly('Users', () => navigateTo('/admin/users'))"
        >
          Users
        </button>
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          :class="route.path.startsWith('/admin/analytics')
            ? 'bg-vault-surface text-vault-text'
            : 'text-vault-muted hover:text-vault-text hover:bg-vault-surface'"
          @click="adminOnly('Analytics', () => navigateTo('/admin/analytics'))"
        >
          Analytics
        </button>
      </nav>

      <!-- Right actions (hidden on login / access-denied) -->
      <div v-if="!isAuthPage" class="ml-auto flex items-center gap-2">
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

        <!-- Normalize Slugs -->
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface disabled:opacity-50"
          :disabled="normalizingSlugs"
          @click="normalizeSlugs"
        >
          {{ normalizingSlugs ? 'Normalizing…' : 'Normalize Slugs' }}
        </button>
        <span v-if="normalizeStatus === 'done'" class="text-xs text-green-600 shrink-0">{{ normalizeMsg }}</span>
        <span v-if="normalizeStatus === 'error'" class="text-xs text-red-500 shrink-0">{{ normalizeMsg }}</span>

        <!-- Site Settings -->
        <button
          class="px-3 py-1.5 rounded text-xs font-medium transition-colors text-vault-muted hover:text-vault-text hover:bg-vault-surface"
          @click="adminOnly('Site Settings', openSettings)"
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

    <!-- Unauthorized access modal -->
    <div
      v-if="showUnauthorized"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showUnauthorized = false"
    >
      <div class="bg-vault-sidebar border border-vault-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 class="text-base font-semibold text-vault-text mb-1">Admin Access Required</h2>
        <p class="text-sm text-vault-muted mb-4">
          <strong class="text-vault-text">{{ unauthorizedFeature }}</strong> is restricted to administrators.
          Your current role is <strong class="text-vault-text">Author</strong>, which allows you to create
          and edit content but not manage users, analytics, or site settings.
        </p>
        <p class="text-xs text-vault-faint mb-5">
          To gain access, ask a site administrator to update your role to Admin.
        </p>
        <div class="flex justify-end">
          <button
            class="px-4 py-2 rounded-md bg-vault-accent text-white text-sm font-medium hover:bg-vault-accent-hover transition-colors"
            @click="showUnauthorized = false"
          >
            OK
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const siteConfig = useSiteConfig()
const route = useRoute()
const isAuthPage = computed(() =>
  route.path === '/admin/login' || route.path === '/admin/access-denied'
)

// Shared state — the Content page (index.vue) reads showConfigPanel to open its settings modal
const showConfigPanel = useState('adminShowConfigPanel', () => false)

// Fetch current session to determine role (non-blocking; password login has no session → defaults to admin)
const { data: sessionData } = useFetch<{ user: { role: string; name: string } | null }>('/api/auth/session', {
  key: 'admin-layout-session',
})
const isAuthor = computed(() => sessionData.value?.user?.role === 'author')

// Unauthorized modal
const showUnauthorized = ref(false)
const unauthorizedFeature = ref('')

function adminOnly(featureName: string, action: () => void) {
  if (isAuthor.value) {
    unauthorizedFeature.value = featureName
    showUnauthorized.value = true
  } else {
    action()
  }
}

function openSettings() {
  if (route.path === '/admin') {
    showConfigPanel.value = true
  } else {
    navigateTo('/admin?settings=1')
  }
}

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

const normalizingSlugs = ref(false)
const normalizeStatus = ref<'idle' | 'done' | 'error'>('idle')
const normalizeMsg = ref('')

async function normalizeSlugs() {
  normalizingSlugs.value = true
  normalizeStatus.value = 'idle'
  try {
    const result = await $fetch<{ normalized: number; skipped: string[] }>('/api/admin/normalize-slugs', { method: 'POST' })
    const skipNote = result.skipped.length ? `, ${result.skipped.length} skipped` : ''
    normalizeMsg.value = `Normalized ${result.normalized} slugs${skipNote}`
    normalizeStatus.value = 'done'
    setTimeout(() => { normalizeStatus.value = 'idle' }, 5000)
  } catch {
    normalizeMsg.value = 'Normalize failed'
    normalizeStatus.value = 'error'
  } finally {
    normalizingSlugs.value = false
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
