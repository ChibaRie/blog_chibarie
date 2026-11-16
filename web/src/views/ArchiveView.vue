<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchArchive, type ArchiveItem } from '@/api'
import { formatDateDots, formatIndex } from '@/utils/format'

interface ArchiveRow {
  item: ArchiveItem
  no: number
}

const items = ref<ArchiveItem[]>([])
const loading = ref(true)
const error = ref('')

const groups = computed(() => {
  const map = new Map<string, { year: string; list: ArchiveRow[] }>()
  items.value.forEach((item, index) => {
    const raw = item.publishedAt || item.createdAt
    const parsed = raw ? new Date(raw) : null
    const year = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getFullYear()) : '更早'
    if (!map.has(year)) map.set(year, { year, list: [] })
    map.get(year)!.list.push({ item, no: index + 1 })
  })
  return [...map.values()].sort((a, b) => b.year.localeCompare(a.year))
})

const span = computed(() => {
  if (!items.value.length) return null
  const dates = items.value
    .map((item) => item.publishedAt || item.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
  if (!dates.length) return null
  const min = new Date(Math.min(...dates.map((d) => d.getTime())))
  const max = new Date(Math.max(...dates.map((d) => d.getTime())))
  return { first: formatDateDots(min.toISOString()), last: formatDateDots(max.toISOString()) }
})

onMounted(async () => {
  try {
    items.value = await fetchArchive()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '归档加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Archive · All records</span>
      <h1 class="page-head__title">归档</h1>
      <p class="page-head__sub">所有写过的东西，按年份排好。编号从最新一篇开始往回收。</p>
      <div v-if="items.length" class="page-head__fields">
        <span class="arc-field">
          <span>{{ items.length }} 篇</span>
          <span>{{ groups.length }} 个年份</span>
          <template v-if="span">
            <span>最早 {{ span.first }}</span>
            <span>最近 {{ span.last }}</span>
          </template>
        </span>
      </div>
    </header>

    <div v-if="loading" aria-hidden="true">
      <div v-for="i in 8" :key="i" class="skeleton skeleton--row" />
    </div>

    <div v-else-if="error" class="arc-empty">
      <span class="arc-empty__en">// Offline</span>
      <p>{{ error }}。请刷新页面重试。</p>
    </div>

    <div v-else-if="items.length === 0" class="arc-empty">
      <span class="arc-empty__en">// Empty</span>
      <p>还没有文章可以归档。写下一篇后，这里会按年份自动排列。</p>
    </div>

    <div v-else>
      <section
        v-for="(group, groupIndex) in groups"
        :key="group.year"
        class="year-block"
        :aria-labelledby="`year-${groupIndex}`"
      >
        <div class="year-block__side">
          <h2 :id="`year-${groupIndex}`" class="year-block__num">
            {{ group.year }}
            <span aria-hidden="true">{{ group.year }}</span>
          </h2>
          <span class="year-block__count">{{ group.list.length }} 篇</span>
        </div>

        <div class="year-block__list">
          <div v-for="row in group.list" :key="row.item.id" class="arc-record">
            <span class="arc-record__no" aria-hidden="true">No.{{ formatIndex(row.no, 3) }}</span>
            <time class="arc-record__date" :datetime="row.item.publishedAt || row.item.createdAt">
              {{ formatDateDots(row.item.publishedAt || row.item.createdAt) }}
            </time>
            <span class="arc-record__title">
              <RouterLink :to="`/post/${row.item.slug || row.item.id}`">{{ row.item.title }}</RouterLink>
            </span>
            <span class="arc-record__meta">打开 →</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>