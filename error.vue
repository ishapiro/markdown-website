<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

// Guard against an infinite loop: if the home page itself is what 404'd (e.g. a
// stale "Home Page" setting pointing at a note that no longer exists), redirecting
// to "/" again would just 404 again, forever. Only auto-redirect when we're
// somewhere else.
const route = useRoute()
if (props.error.statusCode === 404 && route.path !== '/') {
  await clearError({ redirect: '/' })
}
</script>

<template>
  <div v-if="!(error.statusCode === 404 && route.path !== '/')" class="flex h-screen items-center justify-center bg-vault-bg text-vault-text">
    <div class="text-center">
      <p class="text-5xl font-bold mb-2">{{ error.statusCode }}</p>
      <p class="text-vault-muted mb-6">{{ error.message || 'Something went wrong' }}</p>
      <button
        class="px-4 py-2 rounded bg-vault-accent text-white hover:bg-vault-accent-hover"
        @click="clearError({ redirect: '/' })"
      >
        Go back home
      </button>
    </div>
  </div>
</template>
