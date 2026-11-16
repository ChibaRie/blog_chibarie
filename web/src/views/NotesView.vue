<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchNotes, type Note } from '@/api'
import NoteCard from '@/components/NoteCard.vue'

const PAGE_SIZE = 20

const notes = ref<Note[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

const hasMore = computed(() => notes.value.length < total.value)

async function load(targetPage = 1) {
  if (targetPage === 1) loading.value = true
  else loadingMore.value = true
  error.value = ''
  try {
    const res = await fetchNotes({ page: targetPage, pageSize: PAGE_SIZE })
    notes.value = targetPage === 1 ? res.list : [...notes.value, ...res.list]
    total.value = res.total
    page.value = targetPage
  } catch (err) {
    error.value = err instanceof Error ? err.message : '说说加载失败'
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
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Log · Short notes</span>
      <h1 class="page-head__title">说说</h1>
      <p class="page-head__sub">
        比文章更轻的记录。没有标题，不分类，想到一句就写一句。
      </p>
      <div v-if="total" class="page-head__fields">
        <span class="arc-field">
          <span>共 {{ total }} 条</span>
          <span>按时间倒序</span>
        </span>
      </div>
    </header>

    <div v-if="loading" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="logrow">
        <div class="logrow__time">
          <span class="skeleton skeleton--line" style="width: 88px" />
        </div>
        <div class="logrow__body">
          <span class="skeleton skeleton--line" style="width: 74%" />
          <span class="skeleton skeleton--line" style="width: 52%" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="arc-empty">
      <span class="arc-empty__en">// Offline</span>
      <p>{{ error }}。请刷新页面重试。</p>
      <button type="button" class="arc-btn mt-2" @click="load(1)">重新载入</button>
    </div>

    <div v-else-if="notes.length === 0" class="arc-empty">
      <span class="arc-empty__en">// Empty</span>
      <p>还没有说说。第一条写好后会出现在这里。</p>
    </div>

    <template v-else>
      <ol class="log-stream" data-testid="notes-stream">
        <li v-for="note in notes" :key="note.id">
          <NoteCard :note="note" />
        </li>
      </ol>

      <div v-if="hasMore" class="mt-8 flex justify-center">
        <button type="button" class="arc-btn" :disabled="loadingMore" @click="load(page + 1)">
          {{ loadingMore ? '载入中…' : '载入更早的说说' }}
        </button>
      </div>
      <p v-else class="stills-note justify-center">
        <span>— 已经到底了 —</span>
      </p>
    </template>
  </div>
</template>