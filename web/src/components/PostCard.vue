<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Post } from '@/api'
import { formatDate } from '@/utils/format'

const props = defineProps<{ post: Post }>()

const target = computed(() => `/post/${props.post.slug || props.post.id}`)
const date = computed(() =>
  formatDate(props.post.publishedAt || props.post.createdAt),
)

// 无封面时按 id 轮换渐变，避免整屏占位图长得一样
const PLACEHOLDER_GRADIENTS = [
  'from-sakura-500/40 via-cosmos-600/28 to-night-800',
  'from-cosmos-500/40 via-sakura-500/24 to-night-800',
  'from-sakura-400/35 via-cosmos-500/30 to-night-800',
  'from-cosmos-600/38 via-sakura-400/24 to-night-800',
]

const placeholderGradient = computed(
  () => PLACEHOLDER_GRADIENTS[props.post.id % PLACEHOLDER_GRADIENTS.length],
)
</script>

<template>
  <article class="glass-card glass-card-hover group overflow-hidden">
    <RouterLink :to="target" class="block">
      <div class="relative aspect-[16/10] overflow-hidden">
        <img
          v-if="post.cover"
          :src="post.cover"
          :alt="post.title"
          loading="lazy"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div
          v-else
          class="relative flex h-full w-full items-center justify-center bg-gradient-to-br"
          :class="placeholderGradient"
        >
          <span
            class="max-w-[80%] truncate select-none text-[28px] font-medium tracking-wide text-mist-100/32"
          >
            {{ post.category?.name || '随笔' }}
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            class="absolute bottom-3 right-3 text-mist-100/15"
            aria-hidden="true"
          >
            <path
              d="M12 1.6 L14.6 9.1 L22 12 L14.6 14.9 L12 22.4 L9.4 14.9 L2 12 L9.4 9.1 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <span
          v-if="post.isTop"
          class="absolute left-3 top-3 rounded-full bg-sakura-500/85 px-2.5 py-0.5 text-[12px] text-white backdrop-blur-sm"
        >
          置顶
        </span>
      </div>
    </RouterLink>

    <div class="p-4">
      <h3 class="line-clamp-2 min-h-[2.7em] text-[16px] font-medium leading-snug">
        <RouterLink
          :to="target"
          class="text-mist-100 transition-colors duration-200 group-hover:text-sakura-200"
        >
          {{ post.title }}
        </RouterLink>
      </h3>

      <div class="mt-3 flex items-center gap-3 text-xs text-mist-500">
        <span class="inline-flex items-center gap-1">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10 H21 M8 3 V7 M16 3 V7" />
          </svg>
          {{ date }}
        </span>

        <RouterLink
          v-if="post.category"
          :to="`/categories?slug=${post.category.slug}`"
          class="ml-auto shrink-0 text-sakura-300/80 transition-colors duration-200 hover:text-sakura-200"
        >
          {{ post.category.name }}
        </RouterLink>
      </div>
    </div>
  </article>
</template>
