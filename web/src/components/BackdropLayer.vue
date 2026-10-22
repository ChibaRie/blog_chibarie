<script setup lang="ts">
import { computed } from 'vue'
import { useSite } from '@/composables/useSite'
import { withBase } from '@/utils/asset'

defineProps<{
  /** 遮罩强度，文章页需要更暗以保证长文可读 */
  intensity?: 'soft' | 'strong'
}>()

const { siteInfo } = useSite()
const background = computed(
  () => siteInfo.value?.site.pageBackground || withBase('/images/bg-hero.jpg'),
)
</script>

<template>
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div
      class="backdrop-image absolute inset-0 scale-105 bg-cover bg-center blur-[2px]"
      :style="{ backgroundImage: `url(${background})` }"
    />
    <div
      class="backdrop-veil absolute inset-0"
      :class="intensity === 'strong' ? 'bg-night-950/60' : 'bg-night-950/46'"
    />
    <div
      class="backdrop-fade absolute inset-0"
      :class="
        intensity === 'strong'
          ? 'bg-gradient-to-b from-night-950/34 via-night-950/62 to-night-950/88'
          : 'bg-gradient-to-b from-night-950/14 via-night-950/44 to-night-950/76'
      "
    />
    <div
      class="absolute -top-48 left-1/2 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-sakura-500/12 blur-[130px]"
    />
    <div
      class="absolute -bottom-24 right-0 h-[420px] w-[520px] rounded-full bg-cosmos-500/12 blur-[120px]"
    />
  </div>
</template>
