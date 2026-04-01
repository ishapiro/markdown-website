<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: [] })

const { data: session } = await useFetch<{ user: { email: string; name: string | null; role: string } | null }>('/api/auth/session')

const user = computed(() => session.value?.user ?? null)

const roleLabel: Record<string, string> = {
  user: 'Viewer',
  author: 'Author',
  admin: 'Administrator',
}

async function signOut() {
  await $fetch('/api/auth/logout').catch(() => {})
  await navigateTo('/admin/login')
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-3rem)] items-center justify-center bg-vault-bg">
    <div class="w-full max-w-md rounded-lg border border-vault-border bg-vault-sidebar p-8 shadow-sm">

      <!-- Icon -->
      <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-vault-accent/10">
        <svg class="h-6 w-6 text-vault-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <h1 class="mb-1 text-lg font-semibold text-vault-text">Access restricted</h1>

      <!-- Signed-in account -->
      <div v-if="user" class="mb-5 mt-3 rounded border border-vault-border bg-vault-bg px-3 py-2.5 text-sm">
        <p class="text-vault-muted text-xs mb-0.5">Signed in as</p>
        <p class="font-medium text-vault-text">{{ user.name ?? user.email }}</p>
        <p v-if="user.name" class="text-xs text-vault-muted">{{ user.email }}</p>
        <p class="mt-1.5 text-xs">
          Account type:
          <span class="font-medium text-vault-text">{{ roleLabel[user.role] ?? user.role }}</span>
        </p>
      </div>

      <p class="text-sm text-vault-muted mb-5">
        Your account does not currently have permission to access the admin area.
        To request access, contact the site administrator and ask them to update your account type.
      </p>

      <!-- Permission levels -->
      <div class="mb-6 rounded border border-vault-border overflow-hidden text-xs">
        <div class="bg-vault-surface px-3 py-2 font-medium text-vault-text border-b border-vault-border">
          Permission levels
        </div>
        <div class="divide-y divide-vault-border">
          <div class="flex items-start gap-3 px-3 py-2.5">
            <span class="mt-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 shrink-0">Author</span>
            <span class="text-vault-muted">Can create and edit content (notes and posts).</span>
          </div>
          <div class="flex items-start gap-3 px-3 py-2.5">
            <span class="mt-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 shrink-0">Admin</span>
            <span class="text-vault-muted">Full access — content, user management, analytics, and site settings.</span>
          </div>
        </div>
      </div>

      <button
        class="w-full rounded border border-vault-border py-2 text-sm font-medium text-vault-muted transition-colors hover:text-vault-text hover:bg-vault-surface"
        @click="signOut"
      >
        Sign Out
      </button>

    </div>
  </div>
</template>
