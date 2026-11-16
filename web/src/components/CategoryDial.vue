<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { Category } from '@/api'
import { formatIndex } from '@/utils/format'

const props = defineProps<{ categories: Category[] }>()

const RADIUS = 54
const CIRC = 2 * Math.PI * RADIUS
const GAP = 7
const ALPHAS = [0.92, 0.62, 0.4, 0.24, 0.16]

const hot = ref(-1)
const total = computed(() => props.categories.reduce((sum, item) => sum + item.postCount, 0))

const segments = computed(() => {
  let offset = 0
  return props.categories.map((category, index) => {
    const length = total.value ? (category.postCount / total.value) * CIRC : 0
    const visible = Math.max(0, length - (category.postCount ? GAP : 0))
    const segment = {
      id: category.id,
      slug: category.slug,
      dash: visible,
      rest: CIRC - visible,
      offset,
      hot: hot.value === index,
      stroke: hot.value === index
        ? 'rgb(var(--c-accent))'
        : `rgb(var(--c-ink) / ${ALPHAS[index % ALPHAS.length]})`,
    }
    offset += length
    return segment
  })
})

function setHot(index: number) {
  hot.value = index
}
</script>

<template>
  <div class="dial">
    <div class="dial__figure">
      <svg viewBox="0 0 132 132" aria-hidden="true" focusable="false">
        <circle cx="66" cy="66" :r="RADIUS" fill="none" stroke="rgb(var(--c-ink) / 0.1)" stroke-width="1" />
        <circle
          v-for="(segment, index) in segments"
          :key="segment.id"
          class="dial__seg"
          cx="66"
          cy="66"
          :r="RADIUS"
          :stroke="segment.stroke"
          :stroke-width="segment.hot ? 13 : 9"
          :stroke-dasharray="`${segment.dash} ${segment.rest}`"
          :stroke-dashoffset="-segment.offset"
          :data-hot="segment.hot"
        />
      </svg>
      <div class="dial__center">
        <b>{{ total }}</b>
        <span>Records</span>
      </div>
    </div>

    <div class="dial__legend">
      <RouterLink
        v-for="(category, index) in categories"
        :key="category.id"
        :to="`/categories?slug=${category.slug}`"
        class="dial__row"
        @mouseenter="setHot(index)"
        @mouseleave="setHot(-1)"
        @focus="setHot(index)"
        @blur="setHot(-1)"
      >
        <i aria-hidden="true">{{ formatIndex(index + 1) }}</i>
        <span>{{ category.name }}</span>
        <b>{{ category.postCount }}</b>
      </RouterLink>
    </div>
  </div>
</template>