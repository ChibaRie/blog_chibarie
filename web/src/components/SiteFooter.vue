<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSite } from '@/composables/useSite'
import SocialLinks from '@/components/SocialLinks.vue'

const { siteInfo } = useSite()

const year = new Date().getFullYear()
const siteName = computed(() => siteInfo.value?.site.name || 'chibarie')
const description = computed(() => siteInfo.value?.site.description || '')
const icp = computed(() => siteInfo.value?.site.icp || '')
const location = computed(() => siteInfo.value?.site.socials.location || '')
const snapshot = computed(() => {
  const raw = siteInfo.value?.site.buildAt || ''
  return raw ? raw.slice(0, 10).replace(/-/g, '.') : ''
})
const stats = computed(() => siteInfo.value?.stats)

const links = [
  { cn: '首页', en: 'HOME', to: '/' },
  { cn: '说说', en: 'LOG', to: '/notes' },
  { cn: '图库', en: 'STILLS', to: '/gallery' },
  { cn: '归档', en: 'ARCHIVE', to: '/archive' },
  { cn: '分类', en: 'SECTIONS', to: '/categories' },
  { cn: '标签', en: 'TAGS', to: '/tags' },
  { cn: '友链', en: 'LINKS', to: '/links' },
  { cn: '搜索', en: 'SEARCH', to: '/search' },
]
</script>

<template>
  <footer class="cmd-foot">
    <div class="shell">
      <div class="cmd-foot__main">
        <div class="cmd-foot__brand">
          <p class="cmd-foot__word">CHIBARIE</p>
          <p v-if="description" class="cmd-foot__desc">{{ description }}</p>
          <p class="cmd-foot__desc">
            图像来自博主的个人收藏，版权归原作者所有；如需撤下，请通过 GitHub Issues 联系。
          </p>
        </div>

        <nav class="cmd-foot__links" aria-label="页脚导航">
          <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="cmd-foot__link">
            <span aria-hidden="true">{{ link.en }}</span>{{ link.cn }}
          </RouterLink>
        </nav>

        <div class="grid gap-4 content-start">
          <SocialLinks tone="command" />
          <p v-if="location" class="text-[11px] tracking-[0.16em] uppercase text-cmdInk/45">
            {{ location }}
          </p>
        </div>
      </div>

      <div class="cmd-foot__bottom">
        <span>
          <b>© {{ year }}</b> {{ siteName }}
          <template v-if="stats">
            · 文章 {{ stats.postCount }} · 图 {{ stats.galleryCount }}
          </template>
        </span>
        <span v-if="snapshot"><b>SNAPSHOT</b> {{ snapshot }}</span>
        <span v-if="icp">{{ icp }}</span>
        <span><b>STATIC</b> · GITHUB PAGES</span>
      </div>
    </div>
  </footer>
</template>