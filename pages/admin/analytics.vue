<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin-auth'] })

interface TopPage { path: string; visits: number }
interface RecentVisit { id: number; path: string; startedAt: string | number | null; country: string | null; referrer: string | null; userId: number | null }
interface AnalyticsData {
  topPages: TopPage[]
  uniqueVisitors: number
  totalVisits: number
  recentVisits: RecentVisit[]
}

const { data, refresh, pending } = await useFetch<AnalyticsData>('/api/admin/analytics')

function formatDate(ts: string | number | null) {
  if (!ts) return '—'
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function shortReferrer(ref: string | null) {
  if (!ref) return '—'
  try { return new URL(ref).hostname } catch { return ref.slice(0, 40) }
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-lg font-semibold text-vault-text">Analytics <span class="text-xs font-normal text-vault-muted">(last 30 days)</span></h1>
      <button @click="refresh()" :disabled="pending"
        class="rounded border border-vault-border px-3 py-1.5 text-xs text-vault-muted hover:text-vault-text disabled:opacity-50">
        {{ pending ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    <div v-if="data">
      <!-- Summary stats -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div class="rounded-lg border border-vault-border bg-vault-sidebar p-4">
          <div class="text-2xl font-bold text-vault-text">{{ data.totalVisits.toLocaleString() }}</div>
          <div class="text-xs text-vault-muted mt-1">Total page visits</div>
        </div>
        <div class="rounded-lg border border-vault-border bg-vault-sidebar p-4">
          <div class="text-2xl font-bold text-vault-text">{{ data.uniqueVisitors.toLocaleString() }}</div>
          <div class="text-xs text-vault-muted mt-1">Unique visitors</div>
        </div>
      </div>

      <!-- Top pages -->
      <div class="mb-8">
        <h2 class="text-sm font-medium text-vault-text mb-3">Top pages</h2>
        <div class="rounded-lg border border-vault-border overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-vault-sidebar border-b border-vault-border">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Path</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-vault-muted">Visits</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="page in data.topPages" :key="page.path"
                class="border-b border-vault-border last:border-0 hover:bg-vault-sidebar/50">
                <td class="px-4 py-2.5 text-vault-text font-mono text-xs">{{ page.path }}</td>
                <td class="px-4 py-2.5 text-right text-vault-muted text-xs">{{ page.visits.toLocaleString() }}</td>
              </tr>
              <tr v-if="data.topPages.length === 0">
                <td colspan="2" class="px-4 py-6 text-center text-sm text-vault-muted">No visits recorded yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent visits -->
      <div>
        <h2 class="text-sm font-medium text-vault-text mb-3">Recent visits</h2>
        <div class="rounded-lg border border-vault-border overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-vault-sidebar border-b border-vault-border">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Time</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Path</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Country</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">Referrer</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-vault-muted">User</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="visit in data.recentVisits" :key="visit.id"
                class="border-b border-vault-border last:border-0 hover:bg-vault-sidebar/50">
                <td class="px-4 py-2.5 text-xs text-vault-muted whitespace-nowrap">{{ formatDate(visit.startedAt) }}</td>
                <td class="px-4 py-2.5 text-xs text-vault-text font-mono">{{ visit.path }}</td>
                <td class="px-4 py-2.5 text-xs text-vault-muted">{{ visit.country ?? '—' }}</td>
                <td class="px-4 py-2.5 text-xs text-vault-muted">{{ shortReferrer(visit.referrer) }}</td>
                <td class="px-4 py-2.5 text-xs text-vault-muted">{{ visit.userId ? `#${visit.userId}` : 'anon' }}</td>
              </tr>
              <tr v-if="data.recentVisits.length === 0">
                <td colspan="5" class="px-4 py-6 text-center text-sm text-vault-muted">No visits recorded yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-else-if="pending" class="text-sm text-vault-muted">Loading…</div>
  </div>
</template>
