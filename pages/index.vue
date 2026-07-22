<script setup lang="ts">
import type { PublicSiteConfig } from '~/composables/useSiteConfig'

const { data: config } = await useFetch<PublicSiteConfig>('/api/config')
const homeSlug = computed(() => (config.value?.homePage ?? '/home').replace(/^\//, ''))
</script>

<template>
  <NotePage :slug="homeSlug" is-home />
</template>
