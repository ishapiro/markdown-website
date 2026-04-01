<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface User {
  id: number
  email: string
  name: string | null
  googleSub: string | null
  role: 'user' | 'author' | 'admin'
  about: string | null
  avatarUrl: string | null
  createdAt: string | number
  lastLoginAt: string | number | null
}

const { data: users, refresh } = await useFetch<User[]>('/api/admin/users')

// Add user form
const showAddForm = ref(false)
const addEmail = ref('')
const addName = ref('')
const addRole = ref<'user' | 'author' | 'admin'>('user')
const addAbout = ref('')
const addLoading = ref(false)
const addError = ref('')

async function addUser() {
  if (!addEmail.value) return
  addLoading.value = true
  addError.value = ''
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: { email: addEmail.value, name: addName.value || undefined, role: addRole.value, about: addAbout.value || undefined },
    })
    addEmail.value = ''
    addName.value = ''
    addRole.value = 'user'
    addAbout.value = ''
    showAddForm.value = false
    await refresh()
  } catch (e: any) {
    addError.value = e?.data?.message ?? 'Failed to create user'
  } finally {
    addLoading.value = false
  }
}

// Inline edit
const editingId = ref<number | null>(null)
const editName = ref('')
const editRole = ref<'user' | 'author' | 'admin'>('user')
const editAbout = ref('')
const editLoading = ref(false)
const editError = ref('')

function startEdit(user: User) {
  editingId.value = user.id
  editName.value = user.name ?? ''
  editRole.value = user.role
  editAbout.value = user.about ?? ''
  editError.value = ''
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: number) {
  editLoading.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: { name: editName.value || null, role: editRole.value, about: editAbout.value || null },
    })
    editingId.value = null
    await refresh()
  } catch (e: any) {
    editError.value = e?.data?.message ?? 'Failed to save'
  } finally {
    editLoading.value = false
  }
}

// Delete
const deletingId = ref<number | null>(null)

async function deleteUser(id: number) {
  if (!confirm('Delete this user?')) return
  deletingId.value = id
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.message ?? 'Failed to delete user')
  } finally {
    deletingId.value = null
  }
}

function formatDate(ts: string | number | null) {
  if (!ts) return '—'
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-semibold text-vault-text">Users</h1>
      <button
        class="rounded bg-vault-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-vault-accent-hover"
        @click="showAddForm = !showAddForm"
      >
        New User
      </button>
    </div>

    <!-- Add user form -->
    <div v-if="showAddForm" class="mb-6 rounded-lg border border-vault-border bg-vault-sidebar p-4 space-y-3">
      <h2 class="text-sm font-medium text-vault-text">New User</h2>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-xs text-vault-muted">Email *</label>
          <input v-model="addEmail" type="email" placeholder="user@example.com"
            class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-vault-text outline-none focus:border-vault-accent" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-vault-muted">Name</label>
          <input v-model="addName" type="text" placeholder="Display name"
            class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-vault-text outline-none focus:border-vault-accent" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-vault-muted">Role</label>
          <select v-model="addRole"
            class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-vault-text outline-none focus:border-vault-accent">
            <option value="user">User</option>
            <option value="author">Author</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-vault-muted">About</label>
          <input v-model="addAbout" type="text" placeholder="Short bio"
            class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-vault-text outline-none focus:border-vault-accent" />
        </div>
      </div>
      <p v-if="addError" class="text-xs text-red-500">{{ addError }}</p>
      <div class="flex gap-2">
        <button @click="addUser" :disabled="addLoading || !addEmail"
          class="rounded bg-vault-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-vault-accent-hover disabled:opacity-50">
          {{ addLoading ? 'Adding…' : 'Add User' }}
        </button>
        <button @click="showAddForm = false"
          class="rounded border border-vault-border px-3 py-1.5 text-xs text-vault-muted hover:text-vault-text">
          Cancel
        </button>
      </div>
    </div>

    <!-- Users table -->
    <div class="rounded-lg border border-vault-border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-vault-sidebar border-b border-vault-border">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">User</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Role</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Google</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Joined</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Last login</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="users && users.length > 0">
            <!-- View row -->
            <template v-for="user in users" :key="user.id">
              <tr v-if="editingId !== user.id" class="border-b border-vault-border last:border-0 hover:bg-vault-sidebar/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <img v-if="user.avatarUrl" :src="user.avatarUrl" class="h-6 w-6 rounded-full" alt="" />
                    <div v-else class="h-6 w-6 rounded-full bg-vault-accent/20 flex items-center justify-center text-xs text-vault-accent font-medium">
                      {{ (user.name ?? user.email)[0].toUpperCase() }}
                    </div>
                    <div>
                      <div class="text-vault-text font-medium">{{ user.name ?? '—' }}</div>
                      <div class="text-xs text-vault-muted">{{ user.email }}</div>
                      <div v-if="user.about" class="text-xs text-vault-muted mt-0.5 italic">{{ user.about }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="{
                      'bg-red-100 text-red-700': user.role === 'admin',
                      'bg-blue-100 text-blue-700': user.role === 'author',
                      'bg-vault-border text-vault-muted': user.role === 'user',
                    }">
                    {{ user.role }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="user.googleSub" class="text-xs text-green-600 font-medium">Linked</span>
                  <span v-else class="text-xs text-vault-muted">Pending</span>
                </td>
                <td class="px-4 py-3 text-xs text-vault-muted">{{ formatDate(user.createdAt) }}</td>
                <td class="px-4 py-3 text-xs text-vault-muted">{{ formatDate(user.lastLoginAt) }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button @click="startEdit(user)" class="text-xs text-vault-accent hover:underline">Edit</button>
                    <button @click="deleteUser(user.id)" :disabled="deletingId === user.id"
                      class="text-xs text-red-500 hover:underline disabled:opacity-50">
                      {{ deletingId === user.id ? '…' : 'Delete' }}
                    </button>
                  </div>
                </td>
              </tr>
              <!-- Edit row -->
              <tr v-else class="border-b border-vault-border last:border-0 bg-vault-sidebar/40">
                <td class="px-4 py-3" colspan="6">
                  <div class="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <label class="mb-1 block text-xs text-vault-muted">Name</label>
                      <input v-model="editName" type="text"
                        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-sm text-vault-text outline-none focus:border-vault-accent" />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-vault-muted">Role</label>
                      <select v-model="editRole"
                        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-sm text-vault-text outline-none focus:border-vault-accent">
                        <option value="user">User</option>
                        <option value="author">Author</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-vault-muted">About</label>
                      <input v-model="editAbout" type="text"
                        class="w-full rounded border border-vault-border bg-vault-bg px-2 py-1 text-sm text-vault-text outline-none focus:border-vault-accent" />
                    </div>
                  </div>
                  <p v-if="editError" class="mb-2 text-xs text-red-500">{{ editError }}</p>
                  <div class="flex gap-2">
                    <button @click="saveEdit(user.id)" :disabled="editLoading"
                      class="rounded bg-vault-accent px-3 py-1 text-xs font-medium text-white hover:bg-vault-accent-hover disabled:opacity-50">
                      {{ editLoading ? 'Saving…' : 'Save' }}
                    </button>
                    <button @click="cancelEdit"
                      class="rounded border border-vault-border px-3 py-1 text-xs text-vault-muted hover:text-vault-text">
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </template>
          <tr v-else>
            <td colspan="6" class="px-4 py-8 text-center text-sm text-vault-muted">
              No users yet. Add one above to get started.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
