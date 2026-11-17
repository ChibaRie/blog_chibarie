<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  fetchCategories,
  fetchNotes,
  fetchPosts,
  fetchTags,
  type Category,
  type Note,
  type Post,
  type Tag,
} from '@/api'
import ArtPlate from '@/components/ArtPlate.vue'
import CategoryDial from '@/components/CategoryDial.vue'
import HeroField from '@/components/HeroField.vue'
import NoteCard from '@/components/NoteCard.vue'
import RecordRow from '@/components/RecordRow.vue'
import SettleNumber from '@/components/SettleNumber.vue'
import SocialLinks from '@/components/SocialLinks.vue'
import { useImageViewer } from '@/composables/useImageViewer'
import { useMotion } from '@/composables/useMotion'
import { useSite } from '@/composables/useSite'
import { withBase } from '@/utils/asset'
import { formatBytes, formatIndex } from '@/utils/format'
import { plateAlt, toPreview } from '@/utils/gallery'

const { siteInfo } = useSite()
const { open: openViewer } = useImageViewer()
const { motionEnabled } = useMotion()

const posts = ref<Post[]>([])
const notes = ref<Note[]>([])
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const totalPosts = ref(0)
const totalNotes = ref(0)
const loading = ref(true)
const error = ref('')

const HERO_INTERVAL = 7000
const heroIndex = ref(0)
const heroPaused = ref(false)
const userPaused = ref(false)
const heroVisible = ref(true)
const heroEl = ref<HTMLElement | null>(null)
const loadedFrames = ref<Set<number>>(new Set())
let heroTimer: ReturnType<typeof setInterval> | undefined
let heroObserver: IntersectionObserver | null = null
let seeded = false

interface HeroFrame {
  src: string
  previewSrc: string
  no: number | null
  width: number | null
  height: number | null
  alt: string
}

const frames = computed<HeroFrame[]>(() => {
  const plates = siteInfo.value?.site.heroPlates ?? []
  if (plates.length) {
    return plates.map((item) => ({
      src: item.hero || item.src,
      previewSrc: item.src,
      no: item.no,
      width: item.width,
      height: item.height,
      alt: plateAlt(item),
    }))
  }
  const backgrounds = siteInfo.value?.site.heroBackgrounds ?? []
  const list = backgrounds.length ? backgrounds : [withBase('/images/bg-hero.jpg')]
  return list.map((src) => ({ src, previewSrc: src, no: null, width: null, height: null, alt: '站点头图' }))
})

const currentFrame = computed(() => frames.value[heroIndex.value] || null)
// 当前张与相邻张先加载；跳转时把正在淡出的那张保留住，
// 否则旧帧的 background 被清空、透明度还在，会先闪一块黑。
const artSources = computed(() => {
  const length = frames.value.length
  return frames.value.map((frame, index) => {
    if (loadedFrames.value.has(index)) return frame.src
    const distance = Math.min(
      Math.abs(index - heroIndex.value),
      length - Math.abs(index - heroIndex.value),
    )
    return distance <= 1 ? frame.src : ''
  })
})
const heroReady = computed(() => frames.value.length > 0)

const description = computed(() => siteInfo.value?.site.description || '')
const avatar = computed(() => siteInfo.value?.site.avatar || '')

const heroStats = computed(() => {
  const stats = siteInfo.value?.stats
  if (!stats) return []
  return [
    { cn: '文章', en: 'Posts', value: stats.postCount },
    { cn: '字数', en: 'Words', value: stats.wordCount },
    { cn: '标签', en: 'Tags', value: stats.tagCount },
    { cn: '图版', en: 'Plates', value: stats.galleryCount },
  ]
})

const profileCells = computed(() => {
  const stats = siteInfo.value?.stats
  if (!stats) return []
  const plain = (value: number) => value.toLocaleString('zh-CN')
  return [
    { label: '文章', value: plain(stats.postCount) },
    { label: '字数', value: plain(stats.wordCount) },
    { label: '图版', value: plain(stats.galleryCount) },
    { label: '标签', value: plain(stats.tagCount) },
  ]
})

const featurePlates = computed(() => (siteInfo.value?.site.heroPlates ?? []).slice(0, 5))
const galleryBytes = computed(() => siteInfo.value?.stats.galleryBytes ?? 0)
const topTags = computed(() =>
  [...tags.value]
    .filter((tag) => tag.postCount > 0)
    .sort((a, b) => b.postCount - a.postCount || a.id - b.id)
    .slice(0, 12),
)
const totalTags = computed(() => tags.value.length)

function nextHero() {
  if (frames.value.length < 2) return
  heroIndex.value = (heroIndex.value + 1) % frames.value.length
}

function step(delta: number) {
  if (frames.value.length < 2) return
  heroIndex.value = (heroIndex.value + delta + frames.value.length) % frames.value.length
  restartTimer()
}

function goTo(index: number) {
  heroIndex.value = index
  restartTimer()
}

function restartTimer() {
  if (heroTimer) clearInterval(heroTimer)
  heroTimer = undefined
  if (!motionEnabled.value) return
  if (frames.value.length < 2) return
  if (heroPaused.value || userPaused.value || document.hidden || !heroVisible.value) return
  heroTimer = setInterval(nextHero, HERO_INTERVAL)
}

function toggleUserPause() {
  userPaused.value = !userPaused.value
}

function openCurrent() {
  if (!frames.value.length) return
  openViewer(
    frames.value.map((frame) => ({
      src: frame.previewSrc,
      alt: frame.alt,
      no: frame.no ?? undefined,
      width: frame.width ?? undefined,
      height: frame.height ?? undefined,
    })),
    heroIndex.value,
  )
}

function openFeature(index: number) {
  const plates = featurePlates.value
  if (!plates.length) return
  openViewer(plates.map(toPreview), index)
}

function handleHeroFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  const hero = event.currentTarget as HTMLElement
  if (!(next instanceof Node) || !hero.contains(next)) heroPaused.value = false
}

function handleVisibility() {
  if (document.hidden) {
    if (heroTimer) clearInterval(heroTimer)
    heroTimer = undefined
    return
  }
  restartTimer()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [postPage, notePage, categoryList, tagList] = await Promise.all([
      fetchPosts({ page: 1, pageSize: 12 }),
      fetchNotes({ page: 1, pageSize: 3 }),
      fetchCategories(),
      fetchTags(),
    ])
    posts.value = postPage.list
    totalPosts.value = postPage.total
    notes.value = notePage.list
    totalNotes.value = notePage.total
    categories.value = categoryList
    tags.value = tagList
  } catch (err) {
    error.value = err instanceof Error ? err.message : '内容加载失败'
  } finally {
    loading.value = false
  }
}

watch(
  frames,
  (list) => {
    loadedFrames.value = new Set()
    if (!seeded && list.length > 1) {
      heroIndex.value = Math.floor(Math.random() * list.length)
      seeded = true
    }
    restartTimer()
  },
  { immediate: true },
)

watch(heroIndex, (_next, previous) => {
  if (typeof previous !== 'number') return
  const next = new Set(loadedFrames.value)
  next.add(previous)
  loadedFrames.value = next
})

watch([heroPaused, userPaused, heroVisible, motionEnabled], restartTimer)

onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', handleVisibility)
  if (heroEl.value) {
    heroObserver = new IntersectionObserver(
      (entries) => {
        heroVisible.value = entries.some((entry) => entry.isIntersecting)
      },
      { threshold: 0.05 },
    )
    heroObserver.observe(heroEl.value)
  }
})

onUnmounted(() => {
  if (heroTimer) clearInterval(heroTimer)
  heroObserver?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<template>
  <div>
    <section
      ref="heroEl"
      class="hero"
      @mouseenter="heroPaused = true"
      @mouseleave="heroPaused = false"
      @focusin="heroPaused = true"
      @focusout="handleHeroFocusOut"
    >
      <div class="hero__stage" aria-hidden="true">
        <div
          v-for="(frame, index) in frames"
          :key="frame.src"
          class="hero__art"
          :data-on="index === heroIndex ? 'true' : 'false'"
          :style="artSources[index] ? { backgroundImage: `url(${artSources[index]})` } : undefined"
        />
      </div>
      <div class="hero__veil" aria-hidden="true" />
      <HeroField />
      <p class="sr-only" aria-live="polite">
        第 {{ heroIndex + 1 }} 张，共 {{ frames.length }} 张<template v-if="currentFrame?.no">，图版 No.{{ formatIndex(currentFrame.no, 3) }}</template>
      </p>

      <div class="hero__inner shell">
        <div class="hero__meta">
          <div class="hero__meta-left">
            <span class="hero__label"><b>//</b> Field Archive <span aria-hidden="true">/</span> Personal Records</span>
          </div>
          <div class="hero__meta-right">
            <span v-if="currentFrame?.no" class="hero__plate">
              Plate No.{{ formatIndex(currentFrame.no, 3) }}
              <span aria-hidden="true">/</span>
              {{ currentFrame.width }} × {{ currentFrame.height }}
            </span>
            <span v-else class="arc-stamp">Archive</span>
          </div>
        </div>

        <div class="hero__titleblock">
          <h1 class="hero__title">
            <span class="hero__word">chibarie</span>
            <span class="hero__word hero__word--hollow">Archive</span>
          </h1>
          <div v-if="description" class="hero__quote">
            <span class="hero__quote-label">// Signature</span>
            <p>{{ description }}</p>
          </div>
        </div>

        <div class="hero__foot">
          <div v-if="heroStats.length" class="hero__stats">
            <div v-for="stat in heroStats" :key="stat.en" class="hero__stat">
              <SettleNumber class="hero__stat-num" :value="stat.value" />
              <span class="hero__stat-label">{{ stat.cn }} <b>{{ stat.en }}</b></span>
            </div>
          </div>

          <div class="hero__ctrl">
            <button
              type="button"
              class="hero__btn"
              :aria-label="userPaused ? '继续自动切换图版' : '暂停自动切换图版'"
              :title="motionEnabled ? (userPaused ? '继续自动切换图版' : '暂停自动切换图版') : '界面动效已关闭'"
              :disabled="frames.length < 2 || !motionEnabled"
              @click="toggleUserPause"
            >
              <svg v-if="userPaused" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 5.5 19 12 8 18.5z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <path d="M9 5v14M15 5v14" />
              </svg>
            </button>
            <button
              type="button"
              class="hero__btn"
              aria-label="查看当前图版大图"
              :disabled="!heroReady"
              @click="openCurrent"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
              </svg>
            </button>
            <button
              v-if="frames.length > 1"
              type="button"
              class="hero__btn"
              aria-label="上一张图版"
              @click="step(-1)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <span class="hero__counter" aria-hidden="true">
              {{ formatIndex(heroIndex + 1) }} / {{ formatIndex(Math.max(frames.length, 1)) }}
            </span>
            <button
              v-if="frames.length > 1"
              type="button"
              class="hero__btn"
              aria-label="下一张图版"
              @click="step(1)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
            <div v-if="frames.length > 1" class="hero__ticks">
              <button
                v-for="(frame, index) in frames"
                :key="`tick-${frame.src}`"
                type="button"
                class="hero__tick"
                :aria-current="index === heroIndex ? 'true' : 'false'"
                :aria-label="`第 ${index + 1} 张图版`"
                @click="goTo(index)"
              >
                <span aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="shell">
        <header class="arc-head">
          <span class="arc-head__en">// Latest records</span>
          <h2 class="arc-head__cn">最新记录</h2>
          <span v-if="totalPosts" class="arc-head__count">共 {{ totalPosts }} 篇</span>
          <RouterLink to="/archive" class="arc-head__more">
            全部归档
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </RouterLink>
        </header>

        <div class="home-latest mt-8">
          <div>
            <div v-if="loading" aria-hidden="true">
              <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
            </div>

            <div v-else-if="error" class="arc-empty">
              <span class="arc-empty__en">// Offline</span>
              <p>{{ error }}。请刷新页面重试。</p>
            </div>

            <div v-else-if="posts.length === 0" class="arc-empty">
              <span class="arc-empty__en">// Empty</span>
              <p>这里还没有文章。第一篇写好后会出现在这条记录里。</p>
            </div>

            <div v-else class="home-list">
              <RecordRow
                v-for="(post, index) in posts"
                :key="post.id"
                :post="post"
                :index="index + 1"
              />
            </div>

            <div v-if="!loading && posts.length" class="home-list__more">
              <RouterLink to="/archive" class="arc-btn">
                全部归档
                <span aria-hidden="true">→</span>
              </RouterLink>
            </div>
          </div>

          <aside class="home-rail" aria-label="站点资料">
            <div class="arc-plate arc-plate--accent profile">
              <p class="arc-plate__label"><b>Profile</b><span>档案</span></p>
              <div class="profile__top">
                <div class="profile__avatar">
                  <img v-if="avatar" :src="avatar" alt="chibarie 的头像">
                  <img v-else :src="withBase('/images/bg-hero.jpg')" alt="">
                </div>
                <div>
                  <p class="profile__name">chibarie</p>
                  <p class="profile__desc">{{ description }}</p>
                  <SocialLinks class="profile__socials" />
                </div>
              </div>
              <div v-if="profileCells.length" class="profile__stats">
                <div v-for="cell in profileCells" :key="cell.label" class="profile__stat">
                  <b>{{ cell.value }}</b>
                  <span>{{ cell.label }}</span>
                </div>
              </div>
            </div>

            <div class="arc-plate arc-plate--tab">
              <p class="arc-plate__label"><b>Sections</b><span>分类</span></p>
              <CategoryDial v-if="categories.length" :categories="categories" />
            </div>

            <div class="arc-plate">
              <p class="arc-plate__label"><b>Tags</b><span>标签</span></p>
              <div class="tag-index">
                <RouterLink
                  v-for="tag in topTags"
                  :key="tag.id"
                  :to="`/tags?slug=${tag.slug}`"
                  class="arc-tag"
                >
                  {{ tag.name }}
                  <span class="arc-tag__count">{{ tag.postCount }}</span>
                </RouterLink>
                <RouterLink v-if="totalTags > topTags.length" to="/tags" class="tag-index__more">
                  全部 {{ totalTags }} 个标签 →
                </RouterLink>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="featurePlates.length" class="section pt-0">
      <div class="shell">
        <header class="arc-head">
          <span class="arc-head__en">// Stills</span>
          <h2 class="arc-head__cn">图库</h2>
          <span class="arc-head__count">
            {{ siteInfo?.stats.galleryCount }} 张 / {{ formatBytes(galleryBytes) }}
          </span>
          <RouterLink to="/gallery" class="arc-head__more">
            进入图库
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </RouterLink>
        </header>

        <div class="stills-feature mt-8">
          <button
            v-for="(plate, index) in featurePlates"
            :key="plate.no"
            type="button"
            class="stills-feature__cell"
            :class="{ 'stills-feature__cell--wide': index === 0 }"
            :aria-label="`查看${plateAlt(plate)}`"
            @click="openFeature(index)"
          >
            <ArtPlate :item="plate" :eager="index === 0" />
          </button>
        </div>
        <p class="stills-note">
          <span>个人收藏，全部原图保存在图库；编号与尺寸来自文件本身。</span>
          <RouterLink to="/gallery" class="arc-head__more">浏览 {{ siteInfo?.stats.galleryCount }} 张 →</RouterLink>
        </p>
      </div>
    </section>

    <section class="section pt-0">
      <div class="shell">
        <header class="arc-head">
          <span class="arc-head__en">// Log</span>
          <h2 class="arc-head__cn">说说</h2>
          <span v-if="totalNotes" class="arc-head__count">共 {{ totalNotes }} 条</span>
          <RouterLink to="/notes" class="arc-head__more">
            全部说说
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </RouterLink>
        </header>

        <div v-if="!loading && notes.length" class="log-stream mt-8">
          <NoteCard v-for="note in notes" :key="note.id" :note="note" />
        </div>
        <div v-else-if="!loading" class="arc-empty mt-8">
          <span class="arc-empty__en">// Empty</span>
          <p>说说会记录日常里值得写一句的片段，还没有内容。</p>
        </div>
      </div>
    </section>
  </div>
</template>