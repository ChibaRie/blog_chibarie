<script setup lang="ts">
import { computed } from 'vue'
import { useSite } from '@/composables/useSite'
import SocialLinks from '@/components/SocialLinks.vue'
import { withBase } from '@/utils/asset'
import { formatNumber } from '@/utils/format'
import { imagePreview as vImagePreview } from '@/directives/imagePreview'

const { siteInfo } = useSite()

const name = computed(() => siteInfo.value?.site.name || 'chibarie')
const description = computed(
  () => siteInfo.value?.site.description || '记录技术与生活',
)
const stats = computed(() => siteInfo.value?.stats)
const avatar = computed(() => siteInfo.value?.site.avatar || '')

// 正文内容来自 content/about.md，构建时已经渲染好
const aboutHtml = computed(() => siteInfo.value?.site.aboutHtml || '')
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <header class="text-center">
      <div
        class="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-sakura-400/30 shadow-glow"
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

      <h1 class="mt-5 text-2xl font-medium tracking-tight text-mist-100">
        {{ name }}
      </h1>
      <p class="mt-2 text-sm text-mist-400">{{ description }}</p>

      <SocialLinks
        size="md"
        class="mt-4 inline-flex rounded-full bg-night-950/32 px-4 py-1.5 backdrop-blur-sm"
      />

      <div
        v-if="stats"
        class="mt-6 flex items-center justify-center divide-x divide-mist-400/15"
      >
        <div class="px-4 first:pl-0 last:pr-0">
          <div class="text-sm font-medium text-mist-100">
            {{ formatNumber(stats.postCount) }}
          </div>
          <div class="mt-0.5 text-[12px] text-mist-500">文章</div>
        </div>
        <div class="px-4">
          <div class="text-sm font-medium text-mist-100">
            {{ formatNumber(stats.wordCount) }}
          </div>
          <div class="mt-0.5 text-[12px] text-mist-500">总字数</div>
        </div>
        <div class="px-4">
          <div class="text-sm font-medium text-mist-100">
            {{ formatNumber(stats.tagCount) }}
          </div>
          <div class="mt-0.5 text-[12px] text-mist-500">标签</div>
        </div>
      </div>
    </header>

    <div class="divider-glow my-10" />

    <article
      v-if="aboutHtml"
      class="glass-card article-body p-6 sm:p-8"
      v-image-preview
      v-html="aboutHtml"
    />

    <p v-else class="text-center text-sm text-mist-500">
      关于页还没写内容，可以在后台「站点设置 → 关于页内容」里补充。
    </p>
  </div>
</template>
