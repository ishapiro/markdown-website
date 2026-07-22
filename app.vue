<script setup lang="ts">
import type { PublicSiteConfig } from '~/composables/useSiteConfig'
import { FONT_PRESETS, FONT_SIZES } from '~/shared/fontPresets'

const siteConfig = useSiteConfig()
const { data } = await useFetch<PublicSiteConfig>('/api/config', { key: 'site-config' })
if (data.value) siteConfig.value = data.value

const preset = computed(() => FONT_PRESETS[siteConfig.value.fontFamily] ?? FONT_PRESETS['fraunces-manrope'])
const sizePx = computed(() => FONT_SIZES[siteConfig.value.fontSize]?.base ?? 16)
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
}

html, body {
  @apply bg-vault-bg text-vault-text font-sans;
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
