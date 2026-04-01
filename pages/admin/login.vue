<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: [] })

const route = useRoute()
const oauthError = computed(() => {
  const e = route.query.error as string | undefined
  if (!e) return ''
  const messages: Record<string, string> = {
    no_code: 'Google sign-in was cancelled.',
    token_exchange_failed: 'Failed to complete Google sign-in. Please try again.',
    missing_userinfo: 'Could not retrieve your Google account info.',
    email_already_linked: 'This email is linked to a different Google account.',
  }
  return messages[e] ?? `Sign-in error: ${e}`
})

const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  if (!password.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    await navigateTo('/admin')
  } catch {
    error.value = 'Incorrect password'
    password.value = ''
  } finally {
    loading.value = false
  }
}

function signInWithGoogle() {
  window.location.href = '/api/auth/google'
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-3rem)] items-center justify-center bg-vault-bg">
    <div class="w-full max-w-sm rounded-lg border border-vault-border bg-vault-sidebar p-8 shadow-sm">
      <h1 class="mb-6 text-xl font-semibold text-vault-text">Admin access</h1>

      <p v-if="oauthError" class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
        {{ oauthError }}
      </p>

      <!-- Google sign-in -->
      <button
        type="button"
        class="mb-6 flex w-full items-center justify-center gap-2 rounded border border-vault-border bg-vault-bg px-3 py-2 text-sm font-medium text-vault-text transition-colors hover:bg-vault-accent hover:text-white"
        @click="signInWithGoogle"
      >
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div class="relative mb-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-vault-border" />
        </div>
        <div class="relative flex justify-center text-xs">
          <span class="bg-vault-sidebar px-2 text-vault-muted">or use recovery password</span>
        </div>
      </div>

      <!-- Password fallback -->
      <form @submit.prevent="login" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm text-vault-muted">Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter admin password…"
            class="w-full rounded border border-vault-border bg-vault-bg px-3 py-2 text-sm text-vault-text outline-none focus:border-vault-accent"
          />
        </div>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <button
          type="submit"
          class="w-full rounded py-2 text-sm font-semibold text-white transition-colors"
          :class="loading ? 'bg-vault-muted cursor-not-allowed' : 'bg-vault-accent hover:bg-vault-accent-hover'"
          :disabled="loading"
        >
          {{ loading ? 'Checking…' : 'Sign in with password' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <NuxtLink to="/home" class="text-xs text-vault-muted hover:text-vault-text transition-colors">
          Return to Blog
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
