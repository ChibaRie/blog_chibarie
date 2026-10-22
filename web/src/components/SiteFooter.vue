<script setup lang="ts">
import { computed } from 'vue'
import { useSite } from '@/composables/useSite'

const { siteInfo } = useSite()

const year = new Date().getFullYear()
const siteName = computed(() => siteInfo.value?.site.name || 'chibarie')
const icp = computed(() => siteInfo.value?.site.icp || '')
</script>

<template>
  <footer class="mt-20 border-t border-mist-400/10">
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div
        class="flex flex-col items-center justify-between gap-3 sm:flex-row"
      >
        <p class="text-xs text-mist-500">
          © {{ year }} {{ siteName }}
        </p>
      </div>
      <p v-if="icp" class="mt-3 text-center text-xs text-mist-600">
        {{ icp }}
      </p>
    </div>
  </footer>
</template>
