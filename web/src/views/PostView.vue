<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { fetchArchive, fetchPost, likePost, type ArchiveItem, type Post, type TocItem } from '@/api'
import { useSite } from '@/composables/useSite'
import { imagePreview as vImagePreview } from '@/directives/imagePreview'
import { formatDateDots, formatIndex, formatNumber } from '@/utils/format'

const route = useRoute()
const { siteInfo } = useSite()

const post = ref<Post | null>(null)
const html = ref('')
const toc = ref<TocItem[]>([])
const archive = ref<ArchiveItem[]>([])
const loading = ref(true)
const error = ref('')
const likes = ref(0)
const liked = ref(false)
const activeHeading = ref('')
const progress = ref(0)
const articleRef = ref<HTMLElement | null>(null)

const LIKE_KEY = 'chibarie-liked-posts'
const DEFAULT_DESCRIPTION = 'chibarie 的个人档案 —— 技术笔记、生活记录与喜欢的画'

function readLiked(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIKE_KEY) || '[]') as number[]
  } catch {
    return []
  }
}

function saveLiked(ids: number[]) {
  try {
    localStorage.setItem(LIKE_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    // 隐私模式下不持久化
  }
}

const date = computed(() => formatDateDots(post.value?.publishedAt || post.value?.createdAt))
const recordNo = computed(() => {
  if (!post.value) return ''
  const index = archive.value.findIndex((item) => item.id === post.value?.id)
  return index >= 0 ? formatIndex(index + 1, 3) : ''
})
const neighbor = computed(() => {
  if (!post.value) return { newer: null as ArchiveItem | null, older: null as ArchiveItem | null }
  const index = archive.value.findIndex((item) => item.id === post.value?.id)
  if (index < 0) return { newer: null, older: null }
  return {
    newer: index > 0 ? archive.value[index - 1] : null,
    older: index < archive.value.length - 1 ? archive.value[index + 1] : null,
  }
})

let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  if (!toc.value.length) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeHeading.value = entry.target.id
      }
    },
    { rootMargin: '-100px 0px -68% 0px', threshold: 0 },
  )
  for (const item of toc.value) {
    const element = document.getElementById(item.id)
    if (element) observer.observe(element)
  }
}

function updateProgress() {
  const article = articleRef.value
  if (!article) return
  const rect = article.getBoundingClientRect()
  const total = rect.height - window.innerHeight + 200
  const passed = Math.min(Math.max(-rect.top + 120, 0), Math.max(total, 0))
  progress.value = total > 0 ? passed / total : 1
}

let progressFrame = 0
function handleScroll() {
  if (progressFrame) return
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0
    updateProgress()
  })
}

async function load(slug: string) {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchPost(slug)
    post.value = data
    likes.value = data.likes
    liked.value = readLiked().includes(data.id)
    html.value = data.contentHtml
    toc.value = data.toc || []
    activeHeading.value = toc.value[0]?.id || ''

    const siteName = siteInfo.value?.site.name || 'chibarie'
    document.title = `${data.title} · ${siteName}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', data.summary || '')

    archive.value = await fetchArchive()
    requestAnimationFrame(() => {
      updateProgress()
      setupObserver()
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '文章加载失败'
  } finally {
    loading.value = false
  }
}

async function handleLike() {
  if (!post.value || liked.value) return
  try {
    const res = await likePost(post.value.id)
    likes.value = res.likes
    liked.value = true
    saveLiked([...readLiked(), post.value.id])
  } catch {
    // 点赞失败时保持未点赞状态
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  await load(String(route.params.slug))
})

onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('scroll', handleScroll)
  if (progressFrame) cancelAnimationFrame(progressFrame)
  document.querySelector('meta[name="description"]')?.setAttribute('content', DEFAULT_DESCRIPTION)
})

watch(
  () => route.params.slug,
  async (next) => {
    if (!next || next === post.value?.slug) return
    await load(String(next))
  },
)
</script>

<template>
  <Teleport to="body">
    <div class="read-progress" aria-hidden="true">
      <i :style="{ transform: `scaleX(${progress})` }" />
    </div>
  </Teleport>

  <div class="shell">
    <div v-if="loading" class="article-layout" aria-hidden="true">
      <div class="article-main">
        <div class="skeleton skeleton--line mt-10" style="width: 180px" />
        <div class="skeleton mt-6" style="width: 82%; height: 46px" />
        <div class="skeleton mt-3" style="width: 64%; height: 46px" />
        <div class="skeleton mt-6" style="width: 60%; height: 18px" />
        <div class="skeleton mt-8" style="width: 100%; aspect-ratio: 21 / 9" />
        <div v-for="i in 6" :key="i" class="skeleton skeleton--line mt-4" style="width: 100%" />
      </div>
    </div>

    <div v-else-if="error" class="arc-empty mt-10">
      <span class="arc-empty__en">// Not found</span>
      <p>{{ error }}。它可能还没有发布，或者链接里的 slug 不对。</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <RouterLink to="/" class="arc-btn arc-btn--primary">回到首页</RouterLink>
        <RouterLink to="/archive" class="arc-btn">全部归档</RouterLink>
      </div>
    </div>

    <div v-else-if="post" class="article-layout">
      <article ref="articleRef" class="article-main">
        <div class="flex items-center justify-between gap-3 pt-6">
          <RouterLink to="/archive" class="arc-head__more">
            ← 归档
          </RouterLink>
          <span v-if="recordNo" class="arc-stamp arc-stamp--accent">No.{{ recordNo }}</span>
        </div>

        <header class="article-head">
          <div class="article-head__fields">
            <span class="arc-field">
              <span>{{ date }}</span>
              <span v-if="post.category">{{ post.category.name }}</span>
              <span>{{ post.wordCount }} 字</span>
              <span>约 {{ post.readingTime }} 分钟</span>
            </span>
          </div>
          <h1 class="article-title">{{ post.title }}</h1>
          <p v-if="post.summary" class="article-summary">{{ post.summary }}</p>
        </header>

        <figure v-if="post.cover" class="article-cover">
          <div class="arc-plateimg">
            <img :src="post.cover" alt="" loading="eager" decoding="async">
          </div>
        </figure>

        <details v-if="toc.length" class="toc-mobile">
          <summary>
            <span>目录 / Contents</span>
            <span>{{ toc.length }} 节</span>
          </summary>
          <nav class="toc__list" aria-label="文章目录">
            <a
              v-for="(item, index) in toc"
              :key="item.id"
              :href="`#${item.id}`"
              class="toc__link"
              :class="{ 'toc__link--sub': item.level === 3 }"
            >
              <i aria-hidden="true">{{ index + 1 }}</i>
              <span>{{ item.text }}</span>
            </a>
          </nav>
        </details>

        <div class="article-body-wrap">
          <div v-image-preview class="article-body" v-html="html" />
        </div>

        <div class="article-foot">
          <div v-if="post.tags?.length" class="article-tags">
            <RouterLink
              v-for="tag in post.tags"
              :key="tag.id"
              :to="`/tags?slug=${tag.slug}`"
              class="arc-tag"
            >
              {{ tag.name }}
            </RouterLink>
          </div>

          <div class="article-actions">
            <button
              type="button"
              class="like-btn"
              :aria-pressed="liked"
              :aria-label="liked ? `已点赞，${likes} 个赞` : `点个赞，当前 ${likes} 个赞`"
              @click="handleLike"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20.5S4 15.6 4 9.9A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.7-8 10.6-8 10.6Z" />
              </svg>
              <span>{{ liked ? '已点赞' : '点个赞' }}</span>
              <span class="num">{{ formatNumber(likes) }}</span>
            </button>

            <RouterLink to="/archive" class="arc-btn">全部归档</RouterLink>
          </div>

          <nav v-if="neighbor.newer || neighbor.older" class="post-nav" aria-label="相邻文章">
            <RouterLink
              v-if="neighbor.newer"
              :to="`/post/${neighbor.newer.slug || neighbor.newer.id}`"
              class="post-nav__item"
            >
              <span class="post-nav__dir">Newer / 较新</span>
              <span class="post-nav__title">{{ neighbor.newer.title }}</span>
            </RouterLink>
            <div v-else class="post-nav__item post-nav__item--empty" aria-hidden="true" />

            <RouterLink
              v-if="neighbor.older"
              :to="`/post/${neighbor.older.slug || neighbor.older.id}`"
              class="post-nav__item post-nav__item--next"
            >
              <span class="post-nav__dir">Older / 较早</span>
              <span class="post-nav__title">{{ neighbor.older.title }}</span>
            </RouterLink>
            <div v-else class="post-nav__item post-nav__item--empty" aria-hidden="true" />
          </nav>
        </div>
      </article>

      <aside class="toc" aria-label="文章目录">
        <p class="toc__label"><b>//</b> Contents <span>目录</span></p>
        <nav class="toc__list">
          <a
            v-for="(item, index) in toc"
            :key="item.id"
            :href="`#${item.id}`"
            class="toc__link"
            :class="{ 'toc__link--sub': item.level === 3 }"
            :aria-current="activeHeading === item.id ? 'location' : undefined"
          >
            <i aria-hidden="true">{{ index + 1 }}</i>
            <span>{{ item.text }}</span>
          </a>
        </nav>
      </aside>
    </div>
  </div>
</template>