<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchLinks, type FriendLink } from '@/api'

const links = ref<FriendLink[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    links.value = await fetchLinks()
  } catch (err) {
    console.error('[links] 加载友链失败', err)
  } finally {
    loading.value = false
  }
})

// 头像没配的用「首字 + 渐变」占位，不依赖第三方 favicon 服务
const gradients = [
  'from-sakura-400/70 to-cosmos-400/70',
  'from-cosmos-400/70 to-sakura-500/70',
  'from-sakura-500/60 to-cosmos-600/70',
  'from-cosmos-500/60 to-sakura-400/70',
]

const decorated = computed(() =>
  links.value.map((link, index) => ({
    ...link,
    initial: link.name.trim().charAt(0).toUpperCase() || '☆',
    gradient: gradients[index % gradients.length],
    // 展示时去掉协议头，短一点、也避免暴露 https/http 细节
    prettyUrl: link.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
  })),
)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-14 sm:px-6">
    <header class="animate-fadeUp">
      <h1 class="text-3xl font-medium tracking-wide text-mist-100 sm:text-4xl">
        友链
      </h1>
      <p class="mt-4 max-w-2xl text-sm leading-relaxed text-mist-400 sm:text-base">
        常逛的博客和朋友的站点。想交换友链的话，先在本站加上我，再去
        <a
          href="https://github.com/ChibaRie/blog_chibarie/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sakura-300 underline decoration-sakura-400/40 underline-offset-4 transition-colors hover:text-sakura-200"
        >
          GitHub Issues
        </a>
        留下你的站名、地址和介绍就行。
      </p>
    </header>

    <div
      v-if="loading"
      class="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2"
      aria-hidden="true"
    >
      <div v-for="i in 4" :key="i" class="glass-card h-24 animate-pulse" />
    </div>

    <div
      v-else-if="decorated.length"
      class="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <a
        v-for="link in decorated"
        :key="link.id"
        :href="link.url"
        target="_blank"
        rel="noopener"
        class="glass-card glass-card-hover group flex items-center gap-4 rounded-2xl p-5"
      >
        <img
          v-if="link.avatar"
          :src="link.avatar"
          :alt="`${link.name} 的头像`"
          class="h-14 w-14 shrink-0 rounded-full border border-mist-400/15 object-cover"
          loading="lazy"
        />
        <span
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-medium text-white/90"
          :class="link.gradient"
          aria-hidden="true"
        >
          {{ link.initial }}
        </span>

        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5">
            <span class="truncate text-base font-medium text-mist-100 transition-colors group-hover:text-sakura-200">
              {{ link.name }}
            </span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0 text-mist-500 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sakura-300"
              aria-hidden="true"
            >
              <path d="M7 17 L17 7 M9 7 h8 v8" />
            </svg>
          </span>
          <span
            v-if="link.description"
            class="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-mist-400"
          >
            {{ link.description }}
          </span>
          <span class="mt-1 block truncate text-xs text-mist-600">
            {{ link.prettyUrl }}
          </span>
        </span>
      </a>
    </div>

    <div v-else class="glass-card mt-10 rounded-2xl px-6 py-14 text-center">
      <p class="text-sm text-mist-400">这里还没有友链。</p>
      <p class="mt-2 text-xs text-mist-600">
        想交换友链？去
        <a
          href="https://github.com/ChibaRie/blog_chibarie/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sakura-300 hover:text-sakura-200"
        >
          GitHub Issues
        </a>
        留个言吧。
      </p>
    </div>

    <p class="mt-10 text-center text-xs text-mist-600">
      共 {{ decorated.length }} 个站点 · 排名不分先后
    </p>
  </div>
</template>
