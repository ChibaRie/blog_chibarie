<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { settleNumber } from '@/composables/useMotion'

const props = withDefaults(
  defineProps<{ value: number; decimals?: number; duration?: number }>(),
  { decimals: 0, duration: 600 },
)

const display = ref(0)
const formatter = computed(
  () =>
    new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals,
    }),
)
const visual = computed(() => formatter.value.format(display.value))
const accessible = computed(() => formatter.value.format(props.value))

let cancel: () => void = () => {}

function run() {
  cancel()
  cancel = settleNumber(
    props.value,
    (value) => {
      display.value = value
    },
    { duration: props.duration, decimals: props.decimals },
  )
}

onMounted(run)
watch(() => props.value, run)
onUnmounted(() => cancel())
</script>

<template>
  <span class="num">
    <span aria-hidden="true">{{ visual }}</span>
    <span class="sr-only">{{ accessible }}</span>
  </span>
</template>