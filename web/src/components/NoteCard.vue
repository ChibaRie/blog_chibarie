<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Note } from '@/api'
import { useImageViewer } from '@/composables/useImageViewer'
import { formatDateDots, formatIndex } from '@/utils/format'

const props = defineProps<{ note: Note }>()
const { open } = useImageViewer()

const expanded = ref(false)
const date = computed(() => props.note.publishedAt || props.note.createdAt)
const day = computed(() => formatDateDots(date.value))
// 直接取正文里写的时刻（+08:00），不随访客时区漂移
const clock = computed(() => {
  const match = /T(\d{2}:\d{2})/.exec(date.value)
  return match ? match[1] : ''
})
const hasLongText = computed(() => props.note.content.length > 240)
const visibleImages = computed(() => props.note.images.slice(0, 3))
const hiddenCount = computed(() => Math.max(0, props.note.images.length - 3))

function openImage(index: number) {
  open(
    props.note.images.map((src, i) => ({ src, alt: `说说配图 ${i + 1}，共 ${props.note.images.length} 张` })),
    index,
  )
}
</script>

<template>
  <article class="logrow" data-testid="note-item">
    <div class="logrow__time">
      <time class="logrow__date" :datetime="date">{{ day }}</time>
      <span v-if="clock" class="logrow__clock">{{ clock }}</span>
      <span class="logrow__no">No.{{ formatIndex(note.id, 3) }}</span>
    </div>

    <div class="logrow__body">
      <p
        class="logrow__text"
        :style="{ fontSize: `calc(16px * var(--app-body-scale))` }"
        :class="{ 'logrow__text--clamped': hasLongText && !expanded }"
      >{{ note.content }}</p>

      <button
        v-if="hasLongText"
        type="button"
        class="logrow__toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开全文' }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        v-if="visibleImages.length"
        class="logrow__images"
        :class="{ 'logrow__images--single': visibleImages.length === 1 }"
      >
        <button
          v-for="(image, index) in visibleImages"
          :key="image"
          type="button"
          :aria-label="`查看第 ${index + 1} 张配图，共 ${note.images.length} 张`"
          @click="openImage(index)"
        >
          <div class="arc-plateimg">
            <img :src="image" :alt="`说说配图 ${index + 1}`" loading="lazy" decoding="async">
            <span v-if="hiddenCount && index === 2" class="logrow__more" aria-hidden="true">+{{ hiddenCount }}</span>
          </div>
        </button>
      </div>
    </div>
  </article>
</template>