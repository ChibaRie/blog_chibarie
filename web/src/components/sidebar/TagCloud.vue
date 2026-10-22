<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchTags, type Tag } from '@/api'
import PanelCard from './PanelCard.vue'

const tags = ref<Tag[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    tags.value = await fetchTags()
  } catch (err) {
    console.error('[tags] 加载失败', err)
  } finally {
    loading.value = false
  }
})

const MAX_TAGS = 18

const sorted = computed(() =>
  [...tags.value]
    .filter((tag) => tag.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount || a.id - b.id),
)

const visibleTags = computed(() => sorted.value.slice(0, MAX_TAGS))
const hasMore = computed(() => sorted.value.length > MAX_TAGS)
</script>

<template>
  <PanelCard title="标签">
    <div v-if="loading" class="flex flex-wrap gap-2">
      <div
        v-for="i in 6"
        :key="i"
        class="h-6 w-14 animate-pulse rounded-full bg-night-700/50"
      />
    </div>

    <div v-else class="flex flex-wrap gap-2">
      <RouterLink
        v-for="tag in visibleTags"
        :key="tag.id"
        :to="`/tags?slug=${tag.slug}`"
        class="tag-pill tag-pill-hover"
        :class="
          tag.postCount >= 2
            ? 'border-sakura-400/30 bg-sakura-500/18 text-sakura-200'
            : ''
        "
      >
        {{ tag.name }}
        <span class="text-[11px] opacity-70">{{ tag.postCount }}</span>
      </RouterLink>
    </div>

    <RouterLink
      v-if="!loading && hasMore"
      to="/tags"
      class="mt-3.5 inline-flex items-center gap-1 text-xs text-mist-500 transition-colors duration-200 hover:text-sakura-200"
    >
      全部 {{ sorted.length }} 个标签
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 12 H19 M13 6 L19 12 L13 18" />
      </svg>
    </RouterLink>
  </PanelCard>
</template>
