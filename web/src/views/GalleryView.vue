<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchGallery, type GalleryItem, type GalleryOrientation } from '@/api'
import ArtPlate from '@/components/ArtPlate.vue'
import { useImageViewer } from '@/composables/useImageViewer'
import { formatBytes, formatIndex } from '@/utils/format'
import { plateAlt, toPreview } from '@/utils/gallery'

type Pose = 'all' | GalleryOrientation

const route = useRoute()
const router = useRouter()
const { images: viewerImages, index: viewerIndex, isOpen: viewerOpen, open, close } = useImageViewer()

const items = ref<GalleryItem[]>([])
const loading = ref(true)
const error = ref('')

const counts = computed(() => {
  const result: Record<Pose, number> = { all: items.value.length, landscape: 0, portrait: 0, square: 0 }
  for (const item of items.value) result[item.orientation] += 1
  return result
})
const totalBytes = computed(() => items.value.reduce((sum, item) => sum + item.bytes, 0))

const pose = computed<Pose>(() => {
  const value = String(route.query.pose || 'all')
  return value === 'landscape' || value === 'portrait' || value === 'square' ? value : 'all'
})
const visible = computed(() =>
  pose.value === 'all' ? items.value : items.value.filter((item) => item.orientation === pose.value),
)

const gridEl = ref<HTMLElement | null>(null)
const gridWidth = ref(0)
let gridObserver: ResizeObserver | null = null

interface GalleryRow {
  height: number
  items: GalleryItem[]
}

function targetRowHeight(width: number): number {
  if (width < 500) return 128
  if (width < 900) return 170
  return 216
}

/**
 * 把图版排成每行等高、宽度按真实比例铺满的版式。
 * 行高只由该行的比例和决定，所以图片不会被裁切；最后一行保持目标高度。
 */
function packRows(list: GalleryItem[], width: number, target: number): GalleryRow[] {
  if (!width || list.length === 0) return []
  const rows: GalleryRow[] = []
  let row: GalleryItem[] = []
  let ratioSum = 0
  const flush = (isLast: boolean) => {
    if (!row.length) return
    const scaled = (width - row.length) / ratioSum
    rows.push({
      height: isLast ? Math.min(target, scaled) : Math.max(target * 0.8, scaled),
      items: row,
    })
    row = []
    ratioSum = 0
  }
  for (const item of list) {
    const ratio = item.width / item.height
    if (row.length) {
      const heightIfAdded = (width - (row.length + 1)) / (ratioSum + ratio)
      if (heightIfAdded < target * 0.8) flush(false)
    }
    row.push(item)
    ratioSum += ratio
  }
  flush(true)
  return rows
}

const rows = computed(() =>
  packRows(visible.value, gridWidth.value, targetRowHeight(gridWidth.value)),
)

function measureGrid() {
  if (gridEl.value) gridWidth.value = gridEl.value.clientWidth
}

const filters: { value: Pose; cn: string; en: string }[] = [
  { value: 'all', cn: '全部', en: 'All' },
  { value: 'landscape', cn: '横构图', en: 'Landscape' },
  { value: 'portrait', cn: '竖构图', en: 'Portrait' },
  { value: 'square', cn: '方形', en: 'Square' },
]

function setPose(value: Pose) {
  const query = { ...route.query }
  if (value === 'all') delete query.pose
  else query.pose = value
  void router.replace({ query })
}

function openPlate(item: GalleryItem) {
  const index = items.value.findIndex((entry) => entry.no === item.no)
  open(items.value.map(toPreview), Math.max(0, index))
  if (String(route.query.no || '') !== String(item.no)) {
    void router.replace({ query: { ...route.query, no: String(item.no) } })
  }
}

function syncFromQuery() {
  const no = Number(route.query.no)
  if (!Number.isInteger(no)) return
  const index = items.value.findIndex((item) => item.no === no)
  if (index < 0) return
  open(items.value.map(toPreview), index)
}

watch(
  () => route.query.no,
  (value) => {
    if (value === undefined || value === null || value === '') {
      if (viewerOpen.value) close()
      return
    }
    const current = viewerImages.value[viewerIndex.value]?.no
    if (!viewerOpen.value || String(current ?? '') !== String(value)) syncFromQuery()
  },
)

watch(viewerOpen, (openNow) => {
  if (openNow || !route.query.no) return
  const query = { ...route.query }
  delete query.no
  void router.replace({ query })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchGallery()
    syncFromQuery()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '图库加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  measureGrid()
  if (gridEl.value) {
    gridObserver = new ResizeObserver(measureGrid)
    gridObserver.observe(gridEl.value)
  }
})

onUnmounted(() => {
  gridObserver?.disconnect()
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Stills · Local archive</span>
      <h1 class="page-head__title">图库</h1>
      <p class="page-head__sub">
        个人收藏的画。按编号排列，点击查看原图。编号、尺寸与文件大小都来自文件本身。
      </p>
      <div class="page-head__fields">
        <span class="arc-field">
          <span>{{ counts.all }} 张</span>
          <span>{{ formatBytes(totalBytes) }}</span>
          <span>横 {{ counts.landscape }}</span>
          <span>竖 {{ counts.portrait }}</span>
          <span>方 {{ counts.square }}</span>
        </span>
      </div>
    </header>

    <div class="stills-toolbar">
      <div class="stills-filters" role="group" aria-label="按构图筛选">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="arc-chip"
          :aria-pressed="pose === filter.value"
          @click="setPose(filter.value)"
        >
          {{ filter.cn }}
          <span class="arc-chip__count">{{ counts[filter.value] }}</span>
        </button>
      </div>
      <span class="stills-sort__label" aria-hidden="true">
        {{ visible.length }} / {{ items.length }} plates
      </span>
      <p class="sr-only" aria-live="polite">当前显示 {{ visible.length }} 张图版</p>
    </div>

    <div ref="gridEl" class="stills-grid-wrap">
      <div v-if="loading" class="stills-grid stills-grid--loading" aria-hidden="true">
        <div v-for="i in 12" :key="i" class="stills-grid__cell">
          <div class="stills-grid__img skeleton" />
          <div class="stills-grid__meta">
            <span class="skeleton skeleton--line" style="width: 48px" />
          </div>
        </div>
      </div>

      <div v-else-if="error" class="arc-empty mt-6">
        <span class="arc-empty__en">// Offline</span>
        <p>{{ error }}。请刷新页面重试。</p>
        <button type="button" class="arc-btn mt-2" @click="load">重新载入</button>
      </div>

      <div v-else-if="visible.length === 0" class="arc-empty mt-6">
        <span class="arc-empty__en">// Empty</span>
        <p>这个构图下还没有图版。切换筛选，或把图片整理进图库后再构建。</p>
      </div>

      <div v-else class="stills-grid">
        <div
          v-for="(row, rowIndex) in rows"
          :key="rowIndex"
          class="stills-grid__row"
          :style="{ '--row-h': `${row.height}px` }"
        >
          <button
            v-for="item in row.items"
            :key="item.no"
            type="button"
            class="stills-grid__cell"
            :style="{ '--ratio': item.width / item.height }"
            :aria-label="`查看${plateAlt(item)}`"
            @click="openPlate(item)"
          >
            <ArtPlate :item="item" :show-meta="false" />
            <span class="stills-grid__meta">
              <span class="stills-grid__no">No.{{ formatIndex(item.no, 3) }}</span>
              <span v-if="item.width / item.height >= 0.8" class="stills-grid__res">{{ item.width }} × {{ item.height }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <p class="stills-note">
      <span>图像来自博主的个人收藏，版权归原作者所有。如需撤下，请通过 GitHub Issues 联系。</span>
      <span>方向键切换 · Esc 关闭预览</span>
    </p>
  </div>
</template>