import { ref } from 'vue'

export interface PreviewImage { src: string; alt: string }
const images = ref<PreviewImage[]>([])
const index = ref(0)
const isOpen = ref(false)

export function useImageViewer() {
  function open(items: PreviewImage[], selected = 0) {
    if (!items.length) return
    images.value = items
    index.value = Math.max(0, Math.min(items.length - 1, selected))
    isOpen.value = true
  }
  function close() { isOpen.value = false }
  function previous() { index.value = Math.max(0, index.value - 1) }
  function next() { index.value = Math.min(images.value.length - 1, index.value + 1) }
  return { images, index, isOpen, open, close, previous, next }
}
