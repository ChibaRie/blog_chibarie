<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { Note } from '@/api'
import { useSite } from '@/composables/useSite'
import { formatDate, formatNumber, formatRelative } from '@/utils/format'

const props = defineProps<{ note: Note; liked: boolean }>()
defineEmits<{ like: [] }>()
const { siteInfo } = useSite()
const avatar = computed(() => siteInfo.value?.site.avatar || '')
const siteName = computed(() => siteInfo.value?.site.name || 'chibarie')
const date = computed(() => props.note.publishedAt || props.note.createdAt)
const cardRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const galleryRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const textOverflow = ref(false)
const expandable = computed(() => expanded.value || props.note.images.length > 0 || textOverflow.value)
let observer: ResizeObserver | undefined
let resizeAnimation: Animation | undefined
let revision = 0

function measure() {
  const text = textRef.value
  if (text) textOverflow.value = text.scrollHeight > parseFloat(getComputedStyle(text).lineHeight) * 6 + 1
}

async function toggle() {
  const card = cardRef.value
  if (!card) return
  const current = ++revision
  const before = card.getBoundingClientRect()
  resizeAnimation?.cancel()
  expanded.value = !expanded.value
  await nextTick()
  measure()
  await nextTick()
  if (current !== revision) return
  const after = card.getBoundingClientRect()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced) {
    card.style.overflow = 'hidden'
    const animation = card.animate([
      { maxWidth: `${before.width}px`, height: `${before.height}px` },
      { maxWidth: `${after.width}px`, height: `${after.height}px` },
    ], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' })
    resizeAnimation = animation
    animation.finished.then(() => {
      if (resizeAnimation === animation) {
        card.style.removeProperty('overflow')
        resizeAnimation = undefined
      }
    }).catch(() => {})
    if (expanded.value) {
      const frames = [{ opacity: .65 }, { opacity: 1 }]
      textRef.value?.animate(frames, { duration: 300, easing: 'ease-out' })
      galleryRef.value?.animate(frames, { duration: 300, easing: 'ease-out' })
    }
  } else card.style.removeProperty('overflow')
  if (!expanded.value && before.top < 80) card.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
}

onMounted(() => {
  observer = new ResizeObserver(measure)
  if (textRef.value) observer.observe(textRef.value)
  measure()
  void document.fonts.ready.then(measure)
})
onUnmounted(() => { revision++; observer?.disconnect(); resizeAnimation?.cancel() })
</script>

<template>
  <li ref="cardRef" class="glass-card p-5" :class="expanded ? 'note-expanded' : 'note-compact'" data-testid="note-item">
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sakura-500/35 to-cosmos-500/35 text-xs font-medium text-mist-100">
        <img v-if="avatar" :src="avatar" :alt="siteName" class="h-full w-full object-cover">
        <template v-else>{{ siteName.slice(0, 1).toUpperCase() }}</template>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-mist-100">{{ siteName }}</span>
          <time class="text-[12px] text-mist-600" :datetime="date" :title="formatDate(date, true)">{{ formatRelative(date) }}</time>
        </div>
        <p :id="`note-text-${note.id}`" ref="textRef" class="note-copy mt-2.5 whitespace-pre-wrap break-words text-[15px] leading-[1.85] text-mist-200"
          :class="{ 'note-copy-overflow': !expanded && textOverflow }">{{ note.content }}</p>
        <div v-if="note.images.length" :id="`note-images-${note.id}`" ref="galleryRef" class="note-gallery mt-3 grid gap-2"
          :style="{ '--note-image-columns': Math.min(3, note.images.length) }"
          :class="note.images.length === 1 ? 'grid-cols-1' : note.images.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'">
          <a v-for="(image, index) in note.images" :key="image" :href="image" target="_blank" rel="noopener noreferrer"
            :inert="!expanded && index >= 3" class="group block overflow-hidden rounded-lg border border-mist-400/12">
            <img :src="image" :alt="`说说配图 ${index + 1}`" loading="lazy"
              class="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              :class="note.images.length === 1 ? 'max-h-[420px]' : 'aspect-square'">
          </a>
        </div>
        <div class="mt-3.5 flex items-center gap-4">
          <button class="inline-flex items-center gap-1.5 text-[12px] transition-colors" data-testid="note-like"
            :class="liked ? 'text-sakura-300' : 'text-mist-500 hover:text-sakura-200'"
            :aria-label="liked ? '已点赞' : '点赞'" :disabled="liked" @click="$emit('like')">
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M12 20.5C7 16.6 3 13.3 3 9.6 3 6.9 5.1 5 7.6 5c1.7 0 3.3.9 4.4 2.4C13.1 5.9 14.7 5 16.4 5 18.9 5 21 6.9 21 9.6c0 3.7-4 7-9 10.9z" />
            </svg>{{ formatNumber(note.likes) }}
          </button>
          <time class="ml-auto hidden text-[12px] text-mist-600 sm:block" :datetime="date">{{ formatDate(date, true) }}</time>
        </div>
        <button v-if="expandable" type="button" class="note-expansion" :aria-expanded="expanded"
          :aria-controls="`note-text-${note.id}${note.images.length ? ` note-images-${note.id}` : ''}`" @click="toggle">
          <span>{{ expanded ? '收起说说' : '展开说说' }}</span><span v-if="note.images.length" class="note-image-count">{{ note.images.length }} 张配图</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
    </div>
  </li>
</template>

<style src="../styles/notes.css"></style>
