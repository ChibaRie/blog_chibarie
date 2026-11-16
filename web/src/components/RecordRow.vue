<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Post } from '@/api'
import { formatDateDots, formatIndex } from '@/utils/format'

const props = defineProps<{ post: Post; index: number }>()

const target = computed(() => `/post/${props.post.slug || props.post.id}`)
const date = computed(() => formatDateDots(props.post.publishedAt || props.post.createdAt))
const no = computed(() => formatIndex(props.index, 3))
</script>

<template>
  <div class="arc-record">
    <span class="arc-record__no" aria-hidden="true">No.{{ no }}</span>
    <time class="arc-record__date" :datetime="post.publishedAt || post.createdAt">{{ date }}</time>
    <span class="arc-record__title">
      <RouterLink :to="target">{{ post.title }}</RouterLink>
    </span>
    <span class="arc-record__meta">
      <i v-if="post.category">{{ post.category.name }}</i>
      <span>{{ post.readingTime }} 分钟</span>
    </span>
  </div>
</template>