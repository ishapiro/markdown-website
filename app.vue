<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

html, body {
  @apply bg-vault-bg text-vault-text;
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { @apply bg-vault-sidebar; }
::-webkit-scrollbar-thumb { @apply bg-vault-border rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-vault-muted; }
</style>
