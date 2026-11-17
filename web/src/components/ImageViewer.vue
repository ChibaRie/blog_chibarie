<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useImageViewer } from '@/composables/useImageViewer'
import { formatBytes } from '@/utils/format'

const { images, index, isOpen, close, previous, next } = useImageViewer()
const route = useRoute()

const dialogRef = ref<HTMLDialogElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const image = computed(() => images.value[index.value])
const loading = ref(true)
const failed = ref(false)
const retry = ref(0)

const MIN_SCALE = 1
const MAX_SCALE = 6
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const panning = ref(false)
const zoomPercent = computed(() => Math.round(scale.value * 100))
const canPan = computed(() => scale.value > 1.001)

let previousOverflow = ''
let scrollLocked = false

function unlockScroll() {
  if (scrollLocked) {
    document.body.style.overflow = previousOverflow
    scrollLocked = false
  }
}

const plateNo = computed(() => {
  const item = image.value
  if (!item) return ''
  return item.no ? `No.${String(item.no).padStart(3, '0')}` : '配图'
})
const meta = computed(() => {
  const item = image.value
  if (!item) return []
  const list: string[] = []
  if (item.width && item.height) list.push(`${item.width} × ${item.height}`)
  if (item.bytes) list.push(formatBytes(item.bytes))
  return list
})

watch(
  isOpen,
  (open) => {
    const dialog = dialogRef.value
    if (!dialog) return
    if (open && !dialog.open) {
      loading.value = true
      failed.value = false
      retry.value = 0
      resetZoom()
      previousOverflow = document.body.style.overflow
      dialog.showModal()
      document.body.style.overflow = 'hidden'
      scrollLocked = true
    } else if (!open) {
      if (dialog.open) dialog.close()
      unlockScroll()
    }
  },
  { flush: 'post' },
)

watch(
  () => image.value?.src,
  () => {
    loading.value = true
    failed.value = false
    retry.value = 0
    resetZoom()
  },
)

watch(
  () => route.path,
  () => close(),
)

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 以图片布局尺寸计算可拖动范围；缩放不会改变布局尺寸，所以读数稳定。 */
function panLimits(targetScale = scale.value) {
  const stage = stageRef.value
  const img = imgRef.value
  if (!stage || !img) return { x: 0, y: 0 }
  const style = getComputedStyle(stage)
  const availWidth = Math.max(1, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
  const availHeight = Math.max(1, stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))
  return {
    x: Math.max(0, (img.offsetWidth * targetScale - availWidth) / 2),
    y: Math.max(0, (img.offsetHeight * targetScale - availHeight) / 2),
  }
}

function applyOffset(x: number, y: number, targetScale = scale.value) {
  const limit = panLimits(targetScale)
  offset.value = {
    x: clampValue(x, -limit.x, limit.x),
    y: clampValue(y, -limit.y, limit.y),
  }
}

/** 围绕视口内某一点缩放；不给点时围绕图片中心。 */
function setScale(next: number, centerX?: number, centerY?: number) {
  const target = clampValue(Number.isFinite(next) ? next : 1, MIN_SCALE, MAX_SCALE)
  if (Math.abs(target - scale.value) < 0.001) return

  let x = offset.value.x
  let y = offset.value.y
  const stage = stageRef.value
  if (stage && centerX !== undefined && centerY !== undefined) {
    const rect = stage.getBoundingClientRect()
    const px = centerX - (rect.left + rect.width / 2)
    const py = centerY - (rect.top + rect.height / 2)
    const ratio = target / scale.value
    x = px - ratio * (px - x)
    y = py - ratio * (py - y)
  }

  scale.value = target
  if (target <= 1.001) {
    offset.value = { x: 0, y: 0 }
    return
  }
  applyOffset(x, y, target)
}

function stepZoom(direction: 1 | -1) {
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  setScale(
    scale.value * (direction > 0 ? 1.4 : 1 / 1.4),
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  )
}

function resetZoom() {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  panning.value = false
}

function handleWheel(event: WheelEvent) {
  if (!image.value || loading.value) return
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
  const factor = Math.exp(-event.deltaY * unit * 0.0018)
  setScale(scale.value * factor, event.clientX, event.clientY)
}

/* ---------- 拖拽与双指缩放 ---------- */
const pointers = new Map<number, { x: number; y: number }>()
let dragStart: { x: number; y: number; ox: number; oy: number } | null = null
let downOnBackground = false
let dragMoved = false
let pinchStart:
  | { distance: number; scale: number; x: number; y: number; cx: number; cy: number }
  | null = null

function pointerList() {
  return [...pointers.values()]
}

function startPinch() {
  const [a, b] = pointerList()
  if (!a || !b) return
  pinchStart = {
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    scale: scale.value,
    x: offset.value.x,
    y: offset.value.y,
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  }
}

function handlePointerDown(event: PointerEvent) {
  downOnBackground = event.target === stageRef.value
  dragMoved = false
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (loading.value || failed.value) return
  if ((event.target as HTMLElement).closest('button')) return
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size === 1) {
    pinchStart = null
    dragStart = canPan.value
      ? { x: event.clientX, y: event.clientY, ox: offset.value.x, oy: offset.value.y }
      : null
    panning.value = Boolean(dragStart)
  } else if (pointers.size === 2) {
    dragStart = null
    panning.value = true
    startPinch()
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (pointers.size >= 2 && pinchStart) {
    const [a, b] = pointerList()
    if (!a || !b) return
    const stage = stageRef.value
    if (!stage) return
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    const next = clampValue(pinchStart.scale * (distance / pinchStart.distance), MIN_SCALE, MAX_SCALE)
    const ratio = next / pinchStart.scale
    const rect = stage.getBoundingClientRect()
    const px = pinchStart.cx - (rect.left + rect.width / 2)
    const py = pinchStart.cy - (rect.top + rect.height / 2)
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const x = px - ratio * (px - pinchStart.x) + (midX - pinchStart.cx)
    const y = py - ratio * (py - pinchStart.y) + (midY - pinchStart.cy)

    scale.value = next
    if (next <= 1.001) offset.value = { x: 0, y: 0 }
    else applyOffset(x, y, next)
    return
  }

  if (dragStart && canPan.value) {
    const dx = event.clientX - dragStart.x
    const dy = event.clientY - dragStart.y
    if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true
    applyOffset(dragStart.ox + dx, dragStart.oy + dy)
  }
}

function handleStageClick() {
  if (dragMoved) {
    dragMoved = false
    return
  }
  if (downOnBackground) close()
}

function handlePointerEnd(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
  pointers.delete(event.pointerId)

  if (pointers.size === 1) {
    const [point] = pointerList()
    pinchStart = null
    dragStart =
      point && canPan.value
        ? { x: point.x, y: point.y, ox: offset.value.x, oy: offset.value.y }
        : null
    panning.value = Boolean(dragStart)
  } else if (pointers.size === 0) {
    pinchStart = null
    dragStart = null
    panning.value = false
  }
}

function handleDoubleClick(event: MouseEvent) {
  if (canPan.value) resetZoom()
  else setScale(2.4, event.clientX, event.clientY)
}

function handleKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    previous()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  } else if (event.key === 'Home') {
    event.preventDefault()
    index.value = 0
  } else if (event.key === 'End') {
    event.preventDefault()
    index.value = images.value.length - 1
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    stepZoom(1)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    stepZoom(-1)
  } else if (event.key === '0') {
    event.preventDefault()
    resetZoom()
  }
}

function reload() {
  loading.value = true
  failed.value = false
  retry.value += 1
}

function handleClose() {
  close()
  unlockScroll()
  resetZoom()
}

onUnmounted(() => {
  dialogRef.value?.close()
  unlockScroll()
  close()
  resetZoom()
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="image-viewer"
    aria-labelledby="image-viewer-title"
    @cancel.prevent="close"
    @close="handleClose"
    @keydown="handleKey"
  >
    <header class="image-viewer__bar">
      <div class="image-viewer__id">
        <span id="image-viewer-title" class="image-viewer__no">{{ plateNo }}</span>
        <span v-if="images.length > 1" class="image-viewer__meta" aria-live="polite">
          {{ String(index + 1).padStart(2, '0') }} / {{ String(images.length).padStart(2, '0') }}
        </span>
        <span v-if="meta.length" class="image-viewer__meta">
          <span v-for="item in meta" :key="item">{{ item }}</span>
        </span>
      </div>
      <div class="image-viewer__actions">
        <div class="image-viewer__zoom" role="group" aria-label="图片缩放">
          <button
            type="button"
            class="image-viewer__zoombtn"
            aria-label="缩小图片"
            :disabled="scale <= 1.001"
            @click="stepZoom(-1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M6 12h12" />
            </svg>
          </button>
          <button
            type="button"
            class="image-viewer__zoomlevel"
            :aria-label="`重置缩放，当前 ${zoomPercent}%`"
            :disabled="scale <= 1.001"
            @click="resetZoom"
          >{{ zoomPercent }}%</button>
          <button
            type="button"
            class="image-viewer__zoombtn"
            aria-label="放大图片"
            :disabled="scale >= MAX_SCALE - 0.001"
            @click="stepZoom(1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </div>
        <button type="button" class="image-viewer__btn image-viewer__close" aria-label="关闭图片预览" autofocus @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
    </header>

    <div
      ref="stageRef"
      class="image-viewer__stage"
      :class="{ 'image-viewer__stage--zoomed': canPan }"
      @click="handleStageClick"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerEnd"
      @pointercancel="handlePointerEnd"
      @dblclick="handleDoubleClick"
    >
      <button
        v-if="images.length > 1"
        type="button"
        class="image-viewer__btn image-viewer__btn--prev"
        aria-label="上一张"
        :disabled="index === 0"
        @click="previous"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>

      <p v-if="loading && !failed" class="image-viewer__status" role="status">正在载入图像…</p>
      <div v-if="failed" class="image-viewer__status" role="status">
        <p>这张图没能载入。</p>
        <button type="button" @click="reload">重新载入</button>
      </div>
      <img
        v-if="image && isOpen"
        ref="imgRef"
        :key="`${image.src}-${retry}`"
        class="image-viewer__img"
        :class="{ 'image-viewer__img--hidden': loading || failed }"
        :style="{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }"
        :data-zoomed="canPan ? 'true' : 'false'"
        :data-panning="panning ? 'true' : 'false'"
        :src="image.src"
        :alt="image.alt"
        draggable="false"
        @load="loading = false; failed = false"
        @error="failed = true; loading = false"
      >

      <button
        v-if="images.length > 1"
        type="button"
        class="image-viewer__btn image-viewer__btn--next"
        aria-label="下一张"
        :disabled="index === images.length - 1"
        @click="next"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>

    <footer class="image-viewer__foot">
      <span class="truncate">{{ image?.alt }}<template v-if="image?.source"> · <b>{{ image.source }}</b></template></span>
      <span class="image-viewer__hint">滚轮 / 双击缩放 · 拖拽移动 · ← → 切换 · Esc 关闭</span>
    </footer>
  </dialog>
</template>

<style scoped>
.image-viewer__close {
  position: static;
  translate: 0;
}
</style>