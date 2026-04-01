<script setup lang="ts">
const { data: config } = await useFetch('/api/config')
const homePage = (config.value as any)?.homePage ?? '/home'
await navigateTo(homePage, { redirectCode: 301 })
</script>
