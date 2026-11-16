<script setup lang="ts">
import { computed } from 'vue'
import type { GalleryItem } from '@/api'
import { formatIndex } from '@/utils/format'
import { plateAlt } from '@/utils/gallery'

const props = withDefaults(
  defineProps<{
    item: GalleryItem
    /** 覆盖说明文字，默认用编号与真实尺寸 */
    alt?: string
    ratio?: string
    eager?: boolean
    showMeta?: boolean
  }>(),
  { ratio: '', eager: false, showMeta: true },
)

const label = computed(() => props.alt || plateAlt(props.item))
</script>

<template>
  <div class="arc-plateimg" :style="{ aspectRatio: ratio || undefined, '--avg': item.avg }">
    <img
      :src="item.thumb"
      :alt="label"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      :width="item.width"
      :height="item.height"
    >
    <span v-if="showMeta" class="stills-feature__meta">
      <span class="stills-feature__no">No.{{ formatIndex(item.no, 3) }}</span>
      <span class="stills-feature__res">{{ item.width }} × {{ item.height }}</span>
    </span>
  </div>
</template>