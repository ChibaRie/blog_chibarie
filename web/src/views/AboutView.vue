<script setup lang="ts">
import { computed } from 'vue'
import SocialLinks from '@/components/SocialLinks.vue'
import { useSite } from '@/composables/useSite'
import { imagePreview as vImagePreview } from '@/directives/imagePreview'

const { siteInfo } = useSite()

const site = computed(() => siteInfo.value?.site)
const stats = computed(() => siteInfo.value?.stats)
const name = computed(() => site.value?.name || 'chibarie')
const description = computed(() => site.value?.description || '')
const avatar = computed(() => site.value?.avatar || '')
const location = computed(() => site.value?.socials.location || '')
const aboutHtml = computed(() => site.value?.aboutHtml || '')

const cells = computed(() => {
  const value = stats.value
  if (!value) return []
  const plain = (input: number) => input.toLocaleString('zh-CN')
  return [
    { label: '文章', value: plain(value.postCount) },
    { label: '字数', value: plain(value.wordCount) },
    { label: '图版', value: plain(value.galleryCount) },
    { label: '标签', value: plain(value.tagCount) },
  ]
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// About · Profile</span>
      <h1 class="page-head__title">关于</h1>
      <p class="page-head__sub">写代码、玩游戏、听歌、睡觉。这里是这些事留下的一点记录。</p>
    </header>

    <div class="about-grid">
      <aside class="about-side">
        <div class="about-avatar-wrap">
          <div class="about-avatar">
            <img v-if="avatar" :src="avatar" :alt="`${name} 的头像`">
          </div>
        </div>

        <div class="about-identity">
          <h2 class="text-[26px] font-bold tracking-[0.03em]">{{ name }}</h2>
          <p v-if="description">{{ description }}</p>
          <p v-if="location" class="arc-field mt-1"><span>{{ location }}</span></p>
          <SocialLinks class="profile__socials mt-2" />
        </div>

        <div v-if="cells.length" class="profile__stats">
          <div v-for="cell in cells" :key="cell.label" class="profile__stat">
            <b>{{ cell.value }}</b>
            <span>{{ cell.label }}</span>
          </div>
        </div>
      </aside>

      <div v-if="aboutHtml" class="about-body article-body" v-image-preview v-html="aboutHtml" />
      <div v-else class="arc-empty">
        <span class="arc-empty__en">// Empty</span>
        <p>关于页还没有内容。把自我介绍写进 content/about.md 后重新构建即可。</p>
      </div>
    </div>
  </div>
</template>