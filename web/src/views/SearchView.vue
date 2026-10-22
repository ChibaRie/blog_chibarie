<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPosts, type Post } from '@/api'
import ArticleCard from '@/components/ArticleCard.vue'

const route = useRoute()
const router = useRouter()

const keyword = ref((route.query.q as string) || '')
const results = ref<Post[]>([])
const total = ref(0)
const loading = ref(false)
const searched = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined

async function search(raw: string) {
  const term = raw.trim()
  if (!term) {
    results.value = []
    total.value = 0
    searched.value = false
    return
  }

  loading.value = true
  searched.value = true
  try {
    const res = await fetchPosts({ keyword: term, pageSize: 50 })
    results.value = res.list
    total.value = res.total
  } catch (err) {
    console.error('[search] 失败', err)
  } finally {
    loading.value = false
  }
}

watch(keyword, (next) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const term = next.trim()
    void router.replace({
      path: '/search',
      query: term ? { q: term } : {},
    })
    void search(next)
  }, 320)
})

onMounted(() => {
  if (keyword.value) void search(keyword.value)
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <header class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">搜索</h1>
      <p class="mt-2 text-sm text-mist-500">在标题、摘要与正文中查找</p>
    </header>

    <div class="relative">
      <svg
        class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-500"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20 L16.65 16.65" />
      </svg>
      <input
        v-model="keyword"
        type="search"
        class="field py-3 pl-11 text-sm"
        placeholder="输入关键词，比如 Go、并发、随笔…"
        aria-label="搜索关键词"
        autofocus
      />
    </div>

    <div class="mt-8">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 2" :key="i" class="glass-card h-32 animate-pulse" />
      </div>

      <div
        v-else-if="searched && results.length === 0"
        class="glass-card p-10 text-center text-sm text-mist-500"
      >
        没有找到与「{{ keyword }}」相关的文章。
      </div>

      <div v-else-if="results.length > 0">
        <div class="mb-4 flex items-center gap-3">
          <span class="section-label">找到 {{ total }} 篇</span>
          <span class="h-px flex-1 bg-mist-400/12" />
        </div>
        <div class="space-y-4">
          <ArticleCard v-for="post in results" :key="post.id" :post="post" />
        </div>
      </div>

      <div
        v-else
        class="glass-card p-10 text-center text-sm text-mist-500"
      >
        输入关键词开始搜索。
      </div>
    </div>
  </div>
</template>
