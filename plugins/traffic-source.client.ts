// Traffic source capture — runs once per browser session.
// Captures referrer and UTM params from the landing URL and stores them in
// sessionStorage so they can be sent with every page visit beacon.
export default defineNuxtPlugin(() => {
  if (sessionStorage.getItem('mw_source_set')) return

  const params = new URLSearchParams(window.location.search)
  sessionStorage.setItem('mw_source_set', '1')
  sessionStorage.setItem('mw_referrer', document.referrer || '')
  sessionStorage.setItem('mw_utm_source', params.get('utm_source') || '')
  sessionStorage.setItem('mw_utm_medium', params.get('utm_medium') || '')
  sessionStorage.setItem('mw_utm_campaign', params.get('utm_campaign') || '')
})
