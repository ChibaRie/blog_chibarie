<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section class="glass-card p-5">
    <h3 v-if="title" class="section-label mb-4">{{ title }}</h3>
    <slot />
  </section>
</template>
