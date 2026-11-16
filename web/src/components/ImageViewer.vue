<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useImageViewer } from '@/composables/useImageViewer'
import { formatBytes } from '@/utils/format'

const { images, index, isOpen, close, previous, next } = useImageViewer()
const route = useRoute()

const dialogRef = ref<HTMLDialogElement | null>(null)
const image = computed(() => images.value[index.value])
const loading = ref(true)
const failed = ref(false)
const retry = ref(0)

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
  },
)

watch(
  () => route.path,
  () => close(),
)

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
}

onUnmounted(() => {
  dialogRef.value?.close()
  unlockScroll()
  close()
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
      <button type="button" class="image-viewer__btn image-viewer__close" aria-label="关闭图片预览" autofocus @click="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </header>

    <div class="image-viewer__stage" @click.self="close">
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
        :key="`${image.src}-${retry}`"
        class="image-viewer__img"
        :class="{ 'image-viewer__img--hidden': loading || failed }"
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
      <span class="image-viewer__hint">← → 切换 · Esc 关闭</span>
    </footer>
  </dialog>
</template>

<style scoped>
.image-viewer__close {
  position: static;
  translate: 0;
}
</style>