<script setup lang="ts">
import type { PublicSiteConfig } from '~/composables/useSiteConfig'
import { FONT_PRESETS, FONT_SIZES, BACKGROUND_PRESETS, CONTENT_WIDTHS, TEXT_STYLES, HEADING_COLORS, HEADING_RULE_STYLES } from '~/shared/fontPresets'

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
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
html {
  font-size: v-bind('`${sizePx}px`');
}

/* Reduce base font size on mobile — scales all rem-based text down ~2px.
   Keeps body text at an acceptable mobile minimum (≥12px for sm, ≥11px for xs). */
@media (max-width: 767px) {
  html {
    font-size: v-bind('`${sizePx - 2}px`');
  }
}

:root {
  --font-heading: v-bind('preset.heading');
  --font-body: v-bind('preset.body');
  --content-max-width: v-bind('contentMaxWidth');
  --prose-text-color: v-bind('proseTextColor');
  --prose-heading-color: v-bind('headingColor');
  --prose-emphasis-decoration: v-bind('emphasisDecoration');
  --heading-rule-width: v-bind('headingRuleWidth');
}

html, body {
  @apply text-vault-text font-sans;
  background-color: v-bind('background.bg');
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
