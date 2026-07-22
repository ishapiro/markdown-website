<script setup lang="ts">
import type { PublicSiteConfig } from '~/composables/useSiteConfig'
import { FONT_PRESETS, FONT_SIZES, BACKGROUND_PRESETS, CONTENT_WIDTHS, TEXT_STYLES, HEADING_COLORS, HEADING_RULE_STYLES, H2_RULE_COLORS, LOGO_SIZES } from '~/shared/fontPresets'

const siteConfig = useSiteConfig()
const { data } = await useFetch<PublicSiteConfig>('/api/config', { key: 'site-config' })
if (data.value) siteConfig.value = data.value

// Appearance settings (font/background/width/etc.) are editable in /admin. Re-fetch
// whenever navigating away from admin so a save there is guaranteed to be reflected
// on the public site, regardless of the in-admin state patch after saving.
const route = useRoute()
watch(
  () => route.path,
  async (newPath, oldPath) => {
    if (oldPath?.startsWith('/admin') && !newPath.startsWith('/admin')) {
      const fresh = await $fetch<PublicSiteConfig>('/api/config').catch(() => null)
      if (fresh) siteConfig.value = fresh
    }
  },
)

const preset = computed(() => FONT_PRESETS[siteConfig.value.fontFamily] ?? FONT_PRESETS['fraunces-manrope'])
const sizePx = computed(() => FONT_SIZES[siteConfig.value.fontSize]?.base ?? 16)
const background = computed(() => BACKGROUND_PRESETS[siteConfig.value.backgroundPreset] ?? BACKGROUND_PRESETS.white)
const contentMaxWidth = computed(() => `${CONTENT_WIDTHS[siteConfig.value.contentWidth]?.px ?? 960}px`)
const textStyle = computed(() => TEXT_STYLES[siteConfig.value.textStyle] ?? TEXT_STYLES.classic)
const headingColor = computed(() => HEADING_COLORS[siteConfig.value.headingColor]?.color || textStyle.value.color || 'inherit')
const proseTextColor = computed(() => textStyle.value.color || 'inherit')
const emphasisDecoration = computed(() => (textStyle.value.emphasisUnderline ? 'underline' : 'none'))
const headingRuleWidth = computed(() => HEADING_RULE_STYLES[siteConfig.value.headingRuleStyle]?.width ?? '48px')
const h2RuleColor = computed(() => H2_RULE_COLORS[siteConfig.value.h2RuleColor]?.color ?? '#08b94e')
const logoSize = computed(() => `${LOGO_SIZES[siteConfig.value.logoSize]?.px ?? 36}px`)

// These custom properties must live on <html> itself so they inherit correctly to
// every element in the document. Vue's v-bind()-in-<style> instead injects them as
// an inline style on this component's own rendered root node — which, because
// app.vue has no wrapping element, ends up being layouts/default.vue's inner div (a
// *descendant* of <html>, not <html> itself). CSS custom properties only inherit
// downward, so declaring them on :root while their real values live on a descendant
// leaves them permanently unresolved. useHead's htmlAttrs.style sets them directly
// on <html> during SSR, avoiding that mismatch entirely.
const htmlStyle = computed(() => ({
  '--font-heading': preset.value.heading,
  '--font-body': preset.value.body,
  '--content-max-width': contentMaxWidth.value,
  '--prose-text-color': proseTextColor.value,
  '--prose-heading-color': headingColor.value,
  '--prose-emphasis-decoration': emphasisDecoration.value,
  '--heading-rule-width': headingRuleWidth.value,
  '--h2-rule-color': h2RuleColor.value,
  '--font-size-base': `${sizePx.value}px`,
  '--font-size-mobile': `${sizePx.value - 2}px`,
  '--page-bg': background.value.bg,
  '--logo-size': logoSize.value,
}))

useHead({
  htmlAttrs: {
    style: () => Object.entries(htmlStyle.value).map(([k, v]) => `${k}:${v}`).join(';'),
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
html {
  font-size: var(--font-size-base, 16px);
}

/* Reduce base font size on mobile — scales all rem-based text down ~2px.
   Keeps body text at an acceptable mobile minimum (≥12px for sm, ≥11px for xs). */
@media (max-width: 767px) {
  html {
    font-size: var(--font-size-mobile, 14px);
  }
}

html, body {
  @apply text-vault-text font-sans;
  background-color: var(--page-bg, #ffffff);
  line-height: 1.7;
}

h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { @apply bg-vault-sidebar; }
::-webkit-scrollbar-thumb { @apply bg-vault-border rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-vault-muted; }
</style>
