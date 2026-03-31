<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

html {
  font-size: 16px;
}

/* Reduce base font size on mobile — scales all rem-based text down ~2px.
   14px base keeps body text at an acceptable mobile minimum (≥12px for sm, ≥11px for xs). */
@media (max-width: 767px) {
  html {
    font-size: 14px;
  }
}

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
