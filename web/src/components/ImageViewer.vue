<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useImageViewer } from '@/composables/useImageViewer'

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
watch(isOpen, open => {
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
}, { flush: 'post' })
watch(() => image.value?.src, () => { loading.value = true; failed.value = false; retry.value = 0 })
watch(() => route.fullPath, close)
function handleKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') { event.preventDefault(); previous() }
  if (event.key === 'ArrowRight') { event.preventDefault(); next() }
}
function reload() { loading.value = true; failed.value = false; retry.value++ }
function handleClose() { close(); unlockScroll() }
onUnmounted(() => { dialogRef.value?.close(); unlockScroll(); close() })
</script>

<template>
  <dialog ref="dialogRef" class="image-viewer" aria-labelledby="image-viewer-title"
    @cancel.prevent="close" @close="handleClose" @keydown="handleKey">
    <header class="image-viewer-header">
      <div class="image-viewer-heading"><h2 id="image-viewer-title">图片预览</h2><span class="image-viewer-count" aria-live="polite">{{ index + 1 }} / {{ images.length }}</span></div>
      <button type="button" class="image-viewer-button" aria-label="关闭图片预览" autofocus @click="close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <div class="image-viewer-stage" @click.self="close">
      <button v-if="images.length > 1" type="button" class="image-viewer-button image-viewer-previous" aria-label="上一张图片" :disabled="index === 0" @click="previous">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <p v-if="loading && !failed" class="image-viewer-status" role="status">正在加载图片…</p>
      <div v-if="failed" class="image-viewer-error" role="status"><p>图片未能加载</p><button type="button" @click="reload">重新加载</button></div>
      <img v-if="image && isOpen" :key="`${image.src}-${retry}`" class="image-viewer-image" :class="{ 'image-viewer-image-hidden': loading || failed }"
        :src="image.src" :alt="image.alt" draggable="false" @load="failed = false; loading = false" @error="failed = true; loading = false">
      <button v-if="images.length > 1" type="button" class="image-viewer-button image-viewer-next" aria-label="下一张图片" :disabled="index === images.length - 1" @click="next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </button>
    </div>
    <footer class="image-viewer-footer"><p>{{ image?.alt }}</p><span>方向键切换 · Esc 关闭</span></footer>
  </dialog>
</template>

<style scoped>
.image-viewer { width: 100vw; max-width: none; height: 100dvh; max-height: none; margin: 0; padding: 0; border: 0; color: #f0f4fb; background: transparent; overflow: hidden; }
.image-viewer[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.image-viewer::backdrop { background: rgb(5 10 19 / .94); }
.image-viewer-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: max(16px, env(safe-area-inset-top)) 28px 14px; }
.image-viewer-heading { display: flex; align-items: center; gap: 17px; }
.image-viewer-heading h2 { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: .04em; }
.image-viewer-count { font-size: 12px; color: #b8c5d9; font-variant-numeric: tabular-nums; }
.image-viewer-button { display: grid; place-items: center; width: 46px; height: 46px; padding: 0; flex-shrink: 0; border: 1px solid #b8c5d933; border-radius: 13px; background: rgb(24 34 51 / .7); color: #edf3ff; cursor: pointer; transition: background-color .2s, border-color .2s; }
.image-viewer-button:hover:not(:disabled) { border-color: rgb(var(--c-sakura-300)); background: #34425c; }
.image-viewer-button:disabled { opacity: .3; cursor: default; }
.image-viewer-button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.image-viewer-stage { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; padding: 8px 90px; }
.image-viewer-image { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; margin: 0; border: 0; border-radius: 7px; object-fit: contain; }
.image-viewer-image-hidden { visibility: hidden; }
.image-viewer-previous, .image-viewer-next { position: absolute; top: calc(50% - 23px); z-index: 1; }
.image-viewer-previous { left: 24px; }.image-viewer-next { right: 24px; }
.image-viewer-status, .image-viewer-error { position: absolute; padding: 20px; text-align: center; color: #bccadd; font-size: 14px; }
.image-viewer-error button { margin-top: 18px; padding: 10px 20px; min-height: 44px; border: 1px solid #b8c5d944; border-radius: 9px; color: #edf3ff; cursor: pointer; }
.image-viewer-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 60px; padding: 14px 30px max(18px, env(safe-area-inset-bottom)); color: #b8c5d9; font-size: 12px; }
.image-viewer-footer p { margin: 0; overflow-wrap: anywhere; }.image-viewer-footer span { flex-shrink: 0; font-size: 11px; color: #8e9fb9; }
.image-viewer :focus-visible { outline: 2px solid #edb5d5; outline-offset: 4px; }
@media(max-width:640px) {
  .image-viewer-header { padding-inline: 16px; }.image-viewer-heading { gap: 12px; }
  .image-viewer-stage { padding: 4px 12px; }.image-viewer-previous { left: 8px; }.image-viewer-next { right: 8px; }
  .image-viewer-footer { padding-inline: 18px; justify-content: center; text-align: center; }.image-viewer-footer span { display: none; }
}
@media(prefers-reduced-motion:reduce) { .image-viewer-button { transition: none; } }
</style>
