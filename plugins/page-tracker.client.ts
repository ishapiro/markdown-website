// Page visit tracker — fires a beacon on every route change.
// Reads visitor cookie and traffic source from sessionStorage (set by traffic-source plugin).
function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  router.afterEach((to) => {
    // Skip admin and API routes
    if (to.path.startsWith('/admin') || to.path.startsWith('/api')) return

    const visitorId = getCookieValue('mw_visitor_id')
    // Only send beacon if we have a visitor id (cookie set by server middleware)
    if (!visitorId) return

    const payload = {
      path: to.fullPath,
      startedAt: Math.floor(Date.now() / 1000),
      durationSeconds: null,
      referrer: sessionStorage.getItem('mw_referrer') || undefined,
      utmSource: sessionStorage.getItem('mw_utm_source') || undefined,
      utmMedium: sessionStorage.getItem('mw_utm_medium') || undefined,
      utmCampaign: sessionStorage.getItem('mw_utm_campaign') || undefined,
    }

    // Use sendBeacon when available so the request survives page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/tracking/visit', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
    } else {
      fetch('/api/tracking/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {})
    }
  })
})
