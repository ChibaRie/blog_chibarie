<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPosts, type Post } from '@/api'
import PostCard from '@/components/PostCard.vue'
import AuthorCard from '@/components/sidebar/AuthorCard.vue'
import CategoryList from '@/components/sidebar/CategoryList.vue'
import TagCloud from '@/components/sidebar/TagCloud.vue'
import { useSite } from '@/composables/useSite'
import { withBase } from '@/utils/asset'
import { formatNumber } from '@/utils/format'

const { siteInfo } = useSite()

const PAGE_SIZE = 8

const posts = ref<Post[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const hasMore = computed(() => posts.value.length < total.value)
const heroTitle = computed(
  () => siteInfo.value?.site.name?.trim() || 'chibarie',
)
// trim 后再判空：后台里只敲了个空格的话，不该让首页签名变成「只有光标没有字」
const heroDesc = computed(
  () => siteInfo.value?.site.description?.trim() || '记录技术与生活',
)
// 首页头图轮播：数据库里有几张就轮几张，都没配则回落到内置插画
const heroImages = computed(() => {
  const list = siteInfo.value?.site.heroBackgrounds
  if (list && list.length > 0) return list
  return [withBase('/images/bg-hero.jpg')]
})

const heroIndex = ref(0)
const heroPaused = ref(false)
const HERO_INTERVAL = 6000
let heroTimer: ReturnType<typeof setInterval> | undefined

function nextHero() {
  if (heroImages.value.length < 2) return
  heroIndex.value = (heroIndex.value + 1) % heroImages.value.length
}

function restartHeroTimer() {
  if (heroTimer) clearInterval(heroTimer)
  heroTimer = undefined

  if (heroImages.value.length < 2) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (heroPaused.value) return

  heroTimer = setInterval(nextHero, HERO_INTERVAL)
}

function goToHero(index: number) {
  heroIndex.value = index
  restartHeroTimer()
}

function stepHero(delta: number) {
  const total = heroImages.value.length
  if (total < 2) return
  heroIndex.value = (heroIndex.value + delta + total) % total
  restartHeroTimer()
}

watch([heroImages, heroPaused], restartHeroTimer)

const heroStats = computed(() => {
  const s = siteInfo.value?.stats
  if (!s) return []
  return [
    { label: '篇文章', value: formatNumber(s.postCount) },
    { label: '个分类', value: formatNumber(s.categoryCount) },
    { label: '个标签', value: formatNumber(s.tagCount) },
    { label: '总字数', value: formatNumber(s.wordCount) },
  ]
})

async function load(reset = false) {
  if (reset) {
    page.value = 1
    posts.value = []
  }

  if (posts.value.length === 0) loading.value = true
  else loadingMore.value = true
  error.value = ''

  try {
    const res = await fetchPosts({
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    posts.value = page.value === 1 ? res.list : [...posts.value, ...res.list]
    total.value = res.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  void load()
}

// 签名打字机
const typedDesc = ref('')
let typeTimer: ReturnType<typeof setInterval> | undefined
let lastTyped = ''

function startTyping(text: string) {
  if (typeTimer) clearInterval(typeTimer)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    typedDesc.value = text
    return
  }

  typedDesc.value = ''
  let index = 0
  typeTimer = setInterval(() => {
    index += 1
    typedDesc.value = text.slice(0, index)
    if (index >= text.length) {
      if (typeTimer) clearInterval(typeTimer)
      typeTimer = undefined
    }
  }, 95)
}

watch(
  heroDesc,
  (value) => {
    if (value && value !== lastTyped) {
      lastTyped = value
      startTyping(value)
    }
  },
  { immediate: true },
)

function scrollToFeed() {
  const hero = heroRef.value
  if (!hero) return
  window.scrollTo({
    top: hero.getBoundingClientRect().bottom + window.scrollY,
    behavior: 'smooth',
  })
}

// 头图是全屏的，慢慢滚只会看到同一张图被裁切，没有意义。
// 所以在头图范围内只要向下滚，就直接平滑滚过整个头图。
const heroRef = ref<HTMLElement | null>(null)
const SKIP_LOCK_MS = 700
let skipLockedUntil = 0

function handleHeroWheel(event: WheelEvent) {
  if (event.deltaY <= 0) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const hero = heroRef.value
  if (!hero) return

  const heroBottom = hero.getBoundingClientRect().bottom + window.scrollY
  if (window.scrollY >= heroBottom - 8) return

  // 平滑滚动期间吞掉后续滚轮事件，避免连续触发导致抖动
  if (performance.now() < skipLockedUntil) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  skipLockedUntil = performance.now() + SKIP_LOCK_MS
  window.scrollTo({ top: heroBottom, behavior: 'smooth' })
}

onMounted(() => {
  void load(true)
  restartHeroTimer()
  window.addEventListener('wheel', handleHeroWheel, { passive: false })
})

onUnmounted(() => {
  if (typeTimer) clearInterval(typeTimer)
  if (heroTimer) clearInterval(heroTimer)
  window.removeEventListener('wheel', handleHeroWheel)
})
</script>

<template>
  <div>
    <!-- Hero：整屏头图轮播。
         用负 margin 顶到页面最上方，让头图铺到 sticky 导航栏后面，
         否则导航栏区域露出的会是全站背景图，和头图接不上。 -->
    <section
      ref="heroRef"
      class="relative -mt-16 flex h-[100svh] min-h-[560px] items-center justify-center overflow-hidden"
      @mouseenter="heroPaused = true"
      @mouseleave="heroPaused = false"
    >
      <div
        v-for="(image, index) in heroImages"
        :key="image"
        class="absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms] ease-out"
        :class="index === heroIndex ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url(${image})` }"
      />
      <div class="hero-veil absolute inset-0 bg-night-950/26" />
      <div
        class="hero-fade absolute inset-0 bg-gradient-to-b from-night-950/16 via-night-950/40 to-night-950/94"
      />

      <div class="relative z-10 px-6 text-center">
        <h1
          class="text-3xl font-medium tracking-wide text-mist-100 text-glow sm:text-4xl"
        >
          {{ heroTitle }}
        </h1>
        <p class="mt-3 min-h-[1.5rem] text-sm text-mist-300 sm:text-base">
          {{ typedDesc }}<span class="type-cursor" aria-hidden="true" />
        </p>

        <div
          v-if="heroStats.length"
          class="mt-7 flex items-center justify-center divide-x divide-mist-400/15"
        >
          <div
            v-for="item in heroStats"
            :key="item.label"
            class="px-4 first:pl-0 last:pr-0 sm:px-6"
          >
            <div class="text-base font-medium text-mist-100 sm:text-lg">
              {{ item.value }}
            </div>
            <div class="mt-0.5 text-[12px] text-mist-500">{{ item.label }}</div>
          </div>
        </div>
      </div>

      <button
        v-if="heroImages.length > 1"
        type="button"
        class="hero-nav left-3 sm:left-6 lg:left-10"
        aria-label="上一张头图"
        @click="stepHero(-1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5 L8 12 L15 19" />
        </svg>
      </button>

      <button
        v-if="heroImages.length > 1"
        type="button"
        class="hero-nav right-3 sm:right-6 lg:right-10"
        aria-label="下一张头图"
        @click="stepHero(1)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 5 L16 12 L9 19" />
        </svg>
      </button>

      <div
        v-if="heroImages.length > 1"
        class="absolute bottom-[92px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2"
      >
        <button
          v-for="(_, index) in heroImages"
          :key="`hero-dot-${index}`"
          type="button"
          class="h-1.5 rounded-full transition-all duration-300"
          :class="
            index === heroIndex
              ? 'w-7 bg-sakura-200'
              : 'w-1.5 bg-mist-100/45 hover:bg-mist-100/75'
          "
          :aria-label="`切换到第 ${index + 1} 张头图`"
          @click="goToHero(index)"
        />
      </div>

      <button
        class="hero-scroll"
        aria-label="向下浏览文章"
        @click="scrollToFeed"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5 V19 M6 13 L12 19 L18 13" />
        </svg>
      </button>
    </section>

    <!-- 主体 -->
    <div
      id="post-feed"
      class="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16"
    >
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div class="min-w-0">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="section-label">最新文章</h2>
            <div class="flex items-center gap-3">
              <RouterLink
                to="/archive"
                class="hidden items-center gap-1 text-xs text-mist-500 transition-colors duration-200 hover:text-sakura-200 sm:inline-flex"
              >
                查看全部
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
            </div>
          </div>

          <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="i in 4"
              :key="i"
              class="glass-card h-56 animate-pulse"
            />
          </div>

          <div
            v-else-if="error"
            class="glass-card p-6 text-center text-sm text-mist-400"
          >
            <p>{{ error }}</p>
            <button class="btn-ghost mt-4" @click="load(true)">重新加载</button>
          </div>

          <div
            v-else-if="posts.length === 0"
            class="glass-card p-10 text-center text-sm text-mist-500"
          >
            还没有文章，去后台写第一篇吧。
          </div>

          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PostCard
              v-for="post in posts"
              :key="post.id"
              :post="post"
              class="animate-fadeUp"
            />
          </div>

          <div v-if="hasMore" class="mt-6 text-center">
            <button
              class="btn-ghost"
              :disabled="loadingMore"
              @click="loadMore"
            >
              {{ loadingMore ? '加载中…' : '加载更多' }}
            </button>
          </div>
          <p
            v-else-if="posts.length > 0"
            class="mt-6 text-center text-xs text-mist-600"
          >
            已经到底了 · 共 {{ total }} 篇
          </p>
        </div>

        <aside class="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <AuthorCard />
          <CategoryList />
          <TagCloud />
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-nav {
  position: absolute;
  top: 50%;
  z-index: 10;
  display: flex;
  height: 40px;
  width: 40px;
  transform: translateY(-50%);
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(246, 226, 236, 0.28);
  background: rgba(8, 6, 15, 0.3);
  color: rgba(246, 226, 236, 0.86);
  opacity: 0.62;
  backdrop-filter: blur(6px);
  transition:
    opacity 0.25s ease,
    border-color 0.25s ease,
    color 0.25s ease,
    background-color 0.25s ease;
}

.hero-nav:hover,
.hero-nav:focus-visible {
  opacity: 1;
  border-color: rgba(217, 140, 184, 0.7);
  background: rgba(8, 6, 15, 0.5);
  color: #f0c4de;
}

.hero-nav:focus-visible {
  outline: 2px solid rgba(240, 196, 222, 0.85);
  outline-offset: 2px;
}

.hero-scroll {
  position: absolute;
  bottom: 22px;
  left: 50%;
  display: flex;
  height: 38px;
  width: 38px;
  transform: translateX(-50%);
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(246, 226, 236, 0.32);
  background: rgba(8, 6, 15, 0.32);
  color: rgba(246, 226, 236, 0.9);
  backdrop-filter: blur(6px);
  transition:
    border-color 0.25s ease,
    color 0.25s ease,
    background-color 0.25s ease;
  animation: heroBounce 2s ease-in-out infinite;
}

.hero-scroll:hover {
  border-color: rgba(217, 140, 184, 0.7);
  background: rgba(8, 6, 15, 0.5);
  color: #f0c4de;
}

@keyframes heroBounce {
  0%,
  100% {
    transform: translate(-50%, 0);
    opacity: 0.7;
  }
  50% {
    transform: translate(-50%, 7px);
    opacity: 1;
  }
}

.type-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.15em;
  background: currentColor;
  animation: cursorBlink 1s step-end infinite;
}

@keyframes cursorBlink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-scroll {
    animation: none;
    transform: translateX(-50%);
  }
  .type-cursor {
    animation: none;
  }
}
</style>
