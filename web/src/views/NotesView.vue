<script setup lang="ts">
/**
 * 说说页：短文本时间流。
 *
 * 与首页文章卡片不同，这里刻意做成「一条接一条」的流式排布：
 * 说说本身很短，套进卡片网格反而显得稀疏。
 */
import { computed, onMounted, ref } from 'vue'
import { fetchNotes, type Note } from '@/api'
import NoteCard from '@/components/NoteCard.vue'

const PAGE_SIZE = 10

const notes = ref<Note[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)

const hasMore = computed(() => notes.value.length < total.value)

async function load(targetPage = 1) {
  if (targetPage === 1) loading.value = true
  else loadingMore.value = true

  try {
    const res = await fetchNotes({ page: targetPage, pageSize: PAGE_SIZE })
    notes.value = targetPage === 1 ? res.list : [...notes.value, ...res.list]
    total.value = res.total
    page.value = targetPage
  } catch (err) {
    console.error('[notes] 加载失败', err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void load(1)
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <header class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">说说</h1>
    </header>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="glass-card h-32 animate-pulse" />
    </div>

    <div
      v-else-if="notes.length === 0"
      class="glass-card p-12 text-center text-sm text-mist-500"
    >
      还没有说说，去后台发第一条吧。
    </div>

    <template v-else>
      <ol class="notes-stream space-y-4" data-testid="notes-stream">
        <NoteCard v-for="note in notes" :key="note.id" :note="note" />
      </ol>

      <div v-if="hasMore" class="mt-8 flex justify-center">
        <button
          class="btn-ghost"
          :disabled="loadingMore"
          @click="load(page + 1)"
        >
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
      <p v-else class="mt-8 text-center text-[12px] text-mist-600">
        — 已经到底了 —
      </p>
    </template>
  </div>
</template>
