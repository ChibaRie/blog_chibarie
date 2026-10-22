<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { fetchPost, likePost, type Post, type TocItem } from '@/api'
import { useSite } from '@/composables/useSite'
import { formatDate, formatNumber } from '@/utils/format'

const route = useRoute()
const { siteInfo } = useSite()

const post = ref<Post | null>(null)
const html = ref('')
const toc = ref<TocItem[]>([])
const loading = ref(true)
const error = ref('')

const likes = ref(0)
const liked = ref(false)
const activeHeading = ref('')

const LIKE_KEY = 'chibarie-liked-posts'

function readLiked(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIKE_KEY) || '[]') as number[]
  } catch {
    return []
  }
}

function saveLiked(ids: number[]) {
  localStorage.setItem(LIKE_KEY, JSON.stringify(ids))
}

const date = computed(() =>
  formatDate(post.value?.publishedAt || post.value?.createdAt),
)

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

    const siteName = siteInfo.value?.site.name || 'chibarie'
    document.title = `${data.title} · ${siteName}`
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', data.summary || '')
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
  } catch (err) {
    console.error('[like] 失败', err)
  }
}

let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  if (!toc.value.length) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeHeading.value = entry.target.id
        }
      }
    },
    { rootMargin: '-90px 0px -70% 0px', threshold: 0 },
  )

  for (const item of toc.value) {
    const el = document.getElementById(item.id)
    if (el) observer.observe(el)
  }
}

onMounted(async () => {
  await load(String(route.params.slug))
  setTimeout(setupObserver, 120)
})

onUnmounted(() => {
  observer?.disconnect()
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', 'chibarie 的个人博客 —— 记录技术与生活')
})

watch(
  () => route.params.slug,
  async (next) => {
    if (!next || next === post.value?.slug) return
    await load(String(next))
    setTimeout(setupObserver, 120)
  },
)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div v-if="loading" class="mx-auto max-w-3xl space-y-4">
      <div class="h-8 w-2/3 animate-pulse rounded-lg bg-night-700/50" />
      <div class="h-4 w-1/3 animate-pulse rounded bg-night-700/40" />
      <div class="glass-card h-64 animate-pulse" />
    </div>

    <div v-else-if="error" class="glass-card mx-auto max-w-3xl p-10 text-center">
      <p class="text-sm text-mist-400">{{ error }}</p>
      <RouterLink to="/" class="btn-ghost mt-5">返回首页</RouterLink>
    </div>

    <div
      v-else-if="post"
      class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_210px]"
    >
      <article class="min-w-0">
        <RouterLink
          to="/"
          class="inline-flex items-center gap-1.5 text-xs text-mist-500 transition-colors hover:text-sakura-200"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M15 18 L9 12 L15 6" />
          </svg>
          返回首页
        </RouterLink>

        <header class="mt-5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-if="post.isTop"
              class="tag-pill border-sakura-400/40 bg-sakura-500/20 text-sakura-200"
            >
              置顶
            </span>
            <RouterLink
              v-if="post.category"
              :to="`/categories?slug=${post.category.slug}`"
              class="tag-pill tag-pill-hover"
            >
              {{ post.category.name }}
            </RouterLink>
          </div>

          <h1
            class="mt-4 text-2xl font-medium leading-snug tracking-tight text-mist-100 sm:text-3xl"
          >
            {{ post.title }}
          </h1>

          <div
            class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mist-500"
          >
            <span>{{ date }}</span>
            <span>{{ post.wordCount }} 字</span>
            <span>约 {{ post.readingTime }} 分钟</span>
          </div>
        </header>

        <div class="divider-glow my-7" />

        <div class="article-body" v-html="html" />

        <div v-if="post.tags?.length" class="mt-8 flex flex-wrap gap-2">
          <RouterLink
            v-for="tag in post.tags"
            :key="tag.id"
            :to="`/tags?slug=${tag.slug}`"
            class="tag-pill tag-pill-hover"
          >
            # {{ tag.name }}
          </RouterLink>
        </div>

        <div class="mt-10 flex justify-center">
          <button
            class="group flex flex-col items-center gap-1.5 rounded-xl px-6 py-4 transition-colors"
            :class="
              liked
                ? 'text-sakura-300'
                : 'text-mist-400 hover:bg-sakura-500/10 hover:text-sakura-200'
            "
            :disabled="liked"
            @click="handleLike"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              :fill="liked ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="['transition-transform duration-300', liked ? 'scale-110' : 'group-hover:scale-110']"
            >
              <path
                d="M12 21s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.5a4.6 4.6 0 0 1 8 3.1C20 16.4 12 21 12 21z"
              />
            </svg>
            <span class="text-xs">{{ liked ? '已点赞' : '点个赞' }}</span>
            <span class="text-[12px] opacity-70">{{ formatNumber(likes) }}</span>
          </button>
        </div>
      </article>

      <!-- 目录 -->
      <aside class="hidden lg:block">
        <div v-if="toc.length" class="sticky top-24">
          <h3 class="section-label mb-4">目录</h3>
          <nav class="space-y-0.5 border-l border-mist-400/12">
            <a
              v-for="item in toc"
              :key="item.id"
              :href="`#${item.id}`"
              class="block border-l-2 py-1 text-[14px] leading-snug transition-colors duration-200"
              :class="[
                item.level === 3 ? 'pl-6' : 'pl-3',
                activeHeading === item.id
                  ? 'border-sakura-400 text-sakura-200'
                  : 'border-transparent text-mist-500 hover:border-mist-400/40 hover:text-mist-300',
              ]"
            >
              {{ item.text }}
            </a>
          </nav>
        </div>
      </aside>
    </div>
  </div>
</template>
