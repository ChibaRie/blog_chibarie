<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchLinks, type FriendLink } from '@/api'

const links = ref<FriendLink[]>([])
const loading = ref(true)
const error = ref('')

const decorated = computed(() =>
  links.value.map((link) => ({
    ...link,
    initial: link.name.trim().charAt(0).toUpperCase() || '·',
    prettyUrl: link.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  })),
)

onMounted(async () => {
  try {
    links.value = await fetchLinks()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '友链加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Links · Elsewhere</span>
      <h1 class="page-head__title">友链</h1>
      <p class="page-head__sub">
        常逛的博客和朋友的站点。想交换友链，在
        <a
          href="https://github.com/ChibaRie/blog_chibarie/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accentText underline decoration-accent decoration-2 underline-offset-4"
        >GitHub Issues</a>
        留下站名、地址和一句介绍即可。
      </p>
      <div v-if="decorated.length" class="page-head__fields">
        <span class="arc-field">
          <span>{{ decorated.length }} 个站点</span>
          <span>排名不分先后</span>
        </span>
      </div>
    </header>

    <div v-if="loading" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="skeleton skeleton--row" />
    </div>

    <div v-else-if="error" class="arc-empty">
      <span class="arc-empty__en">// Offline</span>
      <p>{{ error }}。请刷新页面重试。</p>
    </div>

    <div v-else-if="decorated.length === 0" class="arc-empty">
      <span class="arc-empty__en">// Empty</span>
      <p>这里还没有友链。带上站名、地址和介绍来 Issues 找我。</p>
    </div>

    <div v-else class="links-list">
      <a
        v-for="link in decorated"
        :key="link.id"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="linkrow"
      >
        <span class="linkrow__avatar">
          <img v-if="link.avatar" :src="link.avatar" :alt="`${link.name} 的头像`" loading="lazy">
          <span v-else class="linkrow__initial" aria-hidden="true">{{ link.initial }}</span>
        </span>
        <span class="linkrow__body">
          <span class="linkrow__name">
            {{ link.name }}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
          <span v-if="link.description" class="linkrow__desc">{{ link.description }}</span>
        </span>
        <span class="linkrow__url">{{ link.prettyUrl }}</span>
      </a>
    </div>

    <p class="stills-note">
      <span>链接直达站外，站点内容与这里无关。</span>
      <a
        href="https://github.com/ChibaRie/blog_chibarie/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="arc-head__more"
      >提交友链 →</a>
    </p>
  </div>
</template>