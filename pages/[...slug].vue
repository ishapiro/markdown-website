<script setup lang="ts">
const route = useRoute()
const slug = computed(() => (route.params.slug as string[]).join('/'))
</script>

<template>
  <NotePage :slug="slug" />
</template>
