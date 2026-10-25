import type { Directive } from 'vue'
import { useImageViewer } from '@/composables/useImageViewer'

function prepare(element: HTMLElement) {
  for (const image of element.querySelectorAll<HTMLImageElement>('img')) {
    const control = image.closest('a') || image
    control.setAttribute('role', 'button')
    control.setAttribute('tabindex', '0')
    control.setAttribute('aria-label', `查看大图：${image.alt || '文章配图'}`)
    control.classList.add('image-preview-trigger')
  }
}

function preview(event: Event) {
  if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target
  if (!(target instanceof Element)) return
  const image = target.closest('img') || target.closest('a')?.querySelector('img')
  const element = event.currentTarget as HTMLElement
  if (!(image instanceof HTMLImageElement) || !element.contains(image)) return
  event.preventDefault()
  const control = image.closest('a') || image
  control.focus({ preventScroll: true })
  const images = [...element.querySelectorAll<HTMLImageElement>('img')]
  useImageViewer().open(images.map(item => ({ src: item.currentSrc || item.src, alt: item.alt || '文章配图' })), images.indexOf(image))
}

export const imagePreview: Directive<HTMLElement> = {
  mounted(element) {
    prepare(element)
    element.addEventListener('click', preview)
    element.addEventListener('keydown', preview)
  },
  updated: prepare,
  unmounted(element) {
    element.removeEventListener('click', preview)
    element.removeEventListener('keydown', preview)
  },
}
