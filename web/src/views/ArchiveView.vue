<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchArchive, type ArchiveItem } from '@/api'
import { formatDate } from '@/utils/format'

const items = ref<ArchiveItem[]>([])
const loading = ref(true)
const error = ref('')

const grouped = computed(() => {
  const map = new Map<string, ArchiveItem[]>()

  for (const item of items.value) {
    const raw = item.publishedAt || item.createdAt
    const parsed = raw ? new Date(raw) : null
    const year =
      parsed && !Number.isNaN(parsed.getTime())
        ? String(parsed.getFullYear())
        : '更早'

    if (!map.has(year)) map.set(year, [])
    map.get(year)!.push(item)
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, list]) => ({ year, list }))
})

onMounted(async () => {
  try {
    items.value = await fetchArchive()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <header class="mb-10">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">归档</h1>
      <p class="mt-2 text-sm text-mist-500">
        共 {{ items.length }} 篇文章，按年份排列
      </p>
    </header>

    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 5"
        :key="i"
        class="h-10 animate-pulse rounded-lg bg-night-700/40"
      />
    </div>

    <div v-else-if="error" class="glass-card p-8 text-center text-sm text-mist-400">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="glass-card p-10 text-center text-sm text-mist-500">
      还没有文章。
    </div>

    <div v-else class="space-y-10">
      <section v-for="group in grouped" :key="group.year">
        <h2
          class="mb-4 flex items-center gap-3 text-lg font-medium text-mist-100"
        >
          <span class="text-sakura-300">{{ group.year }}</span>
          <span class="h-px flex-1 bg-mist-400/12" />
          <span class="text-xs font-normal text-mist-600">
            {{ group.list.length }} 篇
          </span>
        </h2>

        <ul class="space-y-1">
          <li v-for="item in group.list" :key="item.id">
            <RouterLink
              :to="`/post/${item.slug || item.id}`"
              class="group flex items-baseline gap-4 rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-sakura-500/8"
            >
              <time class="shrink-0 font-mono text-xs text-mist-600">
                {{ formatDate(item.publishedAt || item.createdAt).slice(5) }}
              </time>
              <span
                class="min-w-0 flex-1 truncate text-sm text-mist-300 transition-colors group-hover:text-sakura-200"
              >
                {{ item.title }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
