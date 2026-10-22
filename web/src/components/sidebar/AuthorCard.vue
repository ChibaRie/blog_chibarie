<script setup lang="ts">
import { computed } from 'vue'
import { useSite } from '@/composables/useSite'
import SocialLinks from '@/components/SocialLinks.vue'
import { withBase } from '@/utils/asset'
import { formatNumber } from '@/utils/format'

const { siteInfo } = useSite()

const name = computed(() => siteInfo.value?.site.name || 'chibarie')
const description = computed(
  () => siteInfo.value?.site.description || '记录技术与生活',
)
const avatar = computed(() => siteInfo.value?.site.avatar || '')
const stats = computed(() => siteInfo.value?.stats)

const cells = computed(() => [
  { label: '文章', value: formatNumber(stats.value?.postCount) },
  { label: '分类', value: formatNumber(stats.value?.categoryCount) },
  { label: '标签', value: formatNumber(stats.value?.tagCount) },
  { label: '字数', value: formatNumber(stats.value?.wordCount) },
])
</script>

<template>
  <section class="glass-card overflow-hidden">
    <div class="relative px-5 pb-4 pt-6 text-center">
      <div
        class="mx-auto h-[72px] w-[72px] overflow-hidden rounded-full ring-2 ring-sakura-400/30 shadow-glow"
      >
        <img
          v-if="avatar"
          :src="avatar"
          alt=""
          class="h-full w-full object-cover"
        />
        <img
          v-else
          :src="withBase('/images/bg-hero.jpg')"
          alt=""
          class="h-full w-full scale-[3] object-cover"
          style="object-position: 46% 24%"
        />
      </div>

      <h2 class="mt-3.5 text-base font-medium text-mist-100">{{ name }}</h2>
      <p class="mt-1.5 text-xs leading-relaxed text-mist-400">
        {{ description }}
      </p>

      <SocialLinks class="mt-3.5" />
    </div>

    <div class="grid grid-cols-4 border-t border-mist-400/10">
      <div
        v-for="cell in cells"
        :key="cell.label"
        class="flex flex-col items-center gap-0.5 py-3"
      >
        <span class="text-sm font-medium text-mist-100">{{ cell.value }}</span>
        <span class="text-[12px] text-mist-500">{{ cell.label }}</span>
      </div>
    </div>
  </section>
</template>
