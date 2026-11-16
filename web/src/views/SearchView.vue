<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPosts, type Post } from '@/api'
import RecordRow from '@/components/RecordRow.vue'

const route = useRoute()
const router = useRouter()

const keyword = ref(String(route.query.q || ''))
const results = ref<Post[]>([])
const total = ref(0)
const loading = ref(false)
const searched = ref(false)
const error = ref('')
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
  error.value = ''
  searched.value = true
  try {
    const res = await fetchPosts({ keyword: term, pageSize: 50 })
    results.value = res.list
    total.value = res.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败'
  } finally {
    loading.value = false
  }
}

watch(keyword, (next) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const term = next.trim()
    void router.replace({ path: '/search', query: term ? { q: term } : {} })
    void search(next)
  }, 320)
})

watch(
  () => route.query.q,
  (value) => {
    const term = String(value || '')
    if (term !== keyword.value) keyword.value = term
  },
)

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})

if (keyword.value.trim()) void search(keyword.value)
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Search</span>
      <h1 class="page-head__title">搜索</h1>
      <p class="page-head__sub">在标题、摘要与正文里查找。输入会自动更新地址栏，方便把结果发出去。</p>
    </header>

    <div class="search-box">
      <label for="search-input" class="sr-only">搜索关键词</label>
      <input
        id="search-input"
        v-model="keyword"
        type="search"
        autocomplete="off"
        placeholder="Go、并发、装饰器、随笔…"
        :aria-describedby="searched ? 'search-summary' : undefined"
      >
      <span class="search-box__hint" aria-hidden="true">输入关键词</span>
    </div>

    <div class="search-hits">
      <div v-if="searched && !loading" class="search-hits__head">
        <h2 id="search-summary">
          {{ error ? '搜索失败' : `找到 ${total} 篇` }}
          <template v-if="keyword.trim()"> · 「{{ keyword.trim() }}」</template>
        </h2>
        <span aria-hidden="true">{{ results.length }} / {{ total }}</span>
      </div>

      <div v-if="loading" aria-hidden="true">
        <div v-for="i in 3" :key="i" class="skeleton skeleton--row" />
      </div>

      <div v-else-if="error" class="arc-empty">
        <span class="arc-empty__en">// Offline</span>
        <p>{{ error }}。请重试。</p>
      </div>

      <div v-else-if="!searched" class="arc-empty">
        <span class="arc-empty__en">// Ready</span>
        <p>输入关键词开始搜索。可以试试「并发」「Vue」或「随笔」。</p>
      </div>

      <div v-else-if="results.length === 0" class="arc-empty">
        <span class="arc-empty__en">// No match</span>
        <p>没有找到与「{{ keyword.trim() }}」相关的文章。换一个词试试。</p>
      </div>

      <div v-else class="home-list">
        <RecordRow
          v-for="(post, index) in results"
          :key="post.id"
          :post="post"
          :index="index + 1"
        />
      </div>
    </div>
  </div>
</template>