<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: [] })

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
</script>

<template>
  <div class="flex min-h-[calc(100vh-3rem)] items-center justify-center bg-vault-bg">
    <div class="w-full max-w-sm rounded-lg border border-vault-border bg-vault-sidebar p-8 shadow-sm">
      <h1 class="mb-6 text-xl font-semibold text-vault-text">Admin access</h1>

      <form @submit.prevent="login" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm text-vault-muted">Password</label>
          <input
            v-model="password"
            type="password"
            autofocus
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
          {{ loading ? 'Checking…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
