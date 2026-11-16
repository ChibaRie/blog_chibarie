import type { GalleryItem } from '@/api'
import type { PreviewImage } from '@/composables/useImageViewer'
import { formatIndex } from './format'

/** 图版没有标题时，用真实编号与尺寸作说明，不编造名字 */
export function plateAlt(item: GalleryItem): string {
  if (item.title) return item.title
  return `图版 No.${formatIndex(item.no, 3)}，${item.width} × ${item.height}`
}

export function toPreview(item: GalleryItem): PreviewImage {
  return {
    src: item.src,
    alt: plateAlt(item),
    no: item.no,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    source: item.source,
  }
}