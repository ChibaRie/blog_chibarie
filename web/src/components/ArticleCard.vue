<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Post } from '@/api'
import { formatDate } from '@/utils/format'

const props = defineProps<{ post: Post }>()

const target = computed(() => `/post/${props.post.slug || props.post.id}`)
const date = computed(() => formatDate(props.post.publishedAt || props.post.createdAt))
</script>

<template>
  <article class="glass-card glass-card-hover group p-5 sm:p-6">
    <div class="flex flex-wrap items-center gap-2">
      <span
        v-if="post.isTop"
        class="tag-pill border-sakura-400/40 bg-sakura-500/20 text-sakura-200"
      >
        置顶
      </span>
      <RouterLink
        v-if="post.category"
        :to="`/categories?slug=${post.category.slug}`"
        class="tag-pill tag-pill-hover"
      >
        {{ post.category.name }}
      </RouterLink>
    </div>

    <h2 class="mt-3 text-lg font-medium leading-snug tracking-tight">
      <RouterLink
        :to="target"
        class="text-mist-100 transition-colors duration-200 group-hover:text-sakura-200"
      >
        {{ post.title }}
      </RouterLink>
    </h2>

    <p
      v-if="post.summary"
      class="mt-2.5 line-clamp-2 text-sm leading-relaxed text-mist-400"
    >
      {{ post.summary }}
    </p>

    <div
      class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-mist-500"
    >
      <span class="inline-flex items-center gap-1">
        <svg
          width="12"
          height="12"
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
      <span>{{ post.wordCount }} 字</span>
      <span>{{ post.readingTime }} 分钟</span>
    </div>

    <div v-if="post.tags?.length" class="mt-3.5 flex flex-wrap gap-2">
      <RouterLink
        v-for="tag in post.tags"
        :key="tag.id"
        :to="`/tags?slug=${tag.slug}`"
        class="tag-pill tag-pill-hover"
      >
        # {{ tag.name }}
      </RouterLink>
    </div>
  </article>
</template>
