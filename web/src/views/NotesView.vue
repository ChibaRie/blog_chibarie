<script setup lang="ts">
/**
 * 说说页：短文本时间流。
 *
 * 与首页文章卡片不同，这里刻意做成「一条接一条」的流式排布：
 * 说说本身很短，套进卡片网格反而显得稀疏。
 */
import { computed, onMounted, ref } from 'vue'
import { fetchNotes, type Note } from '@/api'
import { useSite } from '@/composables/useSite'
import { formatDate, formatNumber, formatRelative } from '@/utils/format'

const PAGE_SIZE = 10

const { siteInfo } = useSite()

const notes = ref<Note[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)

const LIKE_KEY = 'chibarie-liked-notes'
const likedIds = ref<number[]>([])

const avatar = computed(() => siteInfo.value?.site.avatar || '')
const siteName = computed(() => siteInfo.value?.site.name || 'chibarie')
const hasMore = computed(() => notes.value.length < total.value)

function readLiked(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIKE_KEY) || '[]') as number[]
  } catch {
    return []
  }
}

function persistLiked(ids: number[]) {
  localStorage.setItem(LIKE_KEY, JSON.stringify(ids))
}

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

function handleLike(note: Note) {
  if (likedIds.value.includes(note.id)) return
  note.likes += 1
  likedIds.value = [...likedIds.value, note.id]
  persistLiked(likedIds.value)
}

function noteDate(note: Note) {
  return formatDate(note.publishedAt || note.createdAt, true)
}

onMounted(() => {
  likedIds.value = readLiked()
  void load(1)
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <header class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">说说</h1>
      <p class="mt-2 text-sm leading-relaxed text-mist-400">
        随手记的日常，比文章短，比朋友圈久一点。
        <span class="text-mist-500">共 {{ total }} 条</span>
      </p>
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
        <li v-for="note in notes" :key="note.id" class="glass-card p-5" data-testid="note-item">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sakura-500/35 to-cosmos-500/35 text-xs font-medium text-mist-100"
            >
              <img
                v-if="avatar"
                :src="avatar"
                :alt="siteName"
                class="h-full w-full object-cover"
              />
              <template v-else>{{ siteName.slice(0, 1).toUpperCase() }}</template>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-mist-100">{{ siteName }}</span>
                <time
                  class="text-[12px] text-mist-600"
                  :datetime="note.publishedAt || note.createdAt"
                  :title="noteDate(note)"
                >
                  {{ formatRelative(note.publishedAt || note.createdAt) }}
                </time>
              </div>

              <p
                class="mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-[1.85] text-mist-200"
              >
                {{ note.content }}
              </p>

              <!-- 图片：1 张铺满，2-4 张两列，更多三列 -->
              <div
                v-if="note.images.length"
                class="mt-3 grid gap-2"
                :class="
                  note.images.length === 1
                    ? 'grid-cols-1'
                    : note.images.length <= 4
                      ? 'grid-cols-2'
                      : 'grid-cols-2 sm:grid-cols-3'
                "
              >
                <a
                  v-for="(img, index) in note.images"
                  :key="img"
                  :href="img"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group block overflow-hidden rounded-lg border border-mist-400/12"
                >
                  <img
                    :src="img"
                    :alt="`说说配图 ${index + 1}`"
                    loading="lazy"
                    class="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    :class="
                      note.images.length === 1
                        ? 'max-h-[420px]'
                        : 'aspect-square'
                    "
                  />
                </a>
              </div>

              <div class="mt-3.5 flex items-center gap-4">
                <button
                  class="inline-flex items-center gap-1.5 text-[12px] transition-colors"
                  data-testid="note-like"
                  :class="
                    likedIds.includes(note.id)
                      ? 'text-sakura-300'
                      : 'text-mist-500 hover:text-sakura-200'
                  "
                  :aria-label="likedIds.includes(note.id) ? '已点赞' : '点赞'"
                  :disabled="likedIds.includes(note.id)"
                  @click="handleLike(note)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    :fill="likedIds.includes(note.id) ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="1.8"
                  >
                    <path
                      d="M12 20.5C7 16.6 3 13.3 3 9.6 3 6.9 5.1 5 7.6 5c1.7 0 3.3.9 4.4 2.4C13.1 5.9 14.7 5 16.4 5 18.9 5 21 6.9 21 9.6c0 3.7-4 7-9 10.9z"
                    />
                  </svg>
                  {{ formatNumber(note.likes) }}
                </button>

                <time
                  class="ml-auto hidden text-[12px] text-mist-600 sm:block"
                  :datetime="note.publishedAt || note.createdAt"
                >
                  {{ noteDate(note) }}
                </time>
              </div>
            </div>
          </div>
        </li>
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
