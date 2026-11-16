<script setup lang="ts">
/**
 * 首屏光尘：只做氛围，不承载信息。
 * 30fps 上限、DPR ≤ 1.5、页面隐藏时暂停；系统减少动效时画一帧静态图。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useMotion } from '@/composables/useMotion'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { motionEnabled } = useMotion()
const inView = ref(true)

interface Mote {
  x: number
  y: number
  size: number
  speed: number
  drift: number
  alpha: number
}

const COUNT = 26
let ctx: CanvasRenderingContext2D | null = null
let motes: Mote[] = []
let frame = 0
let lastFrame = 0
let width = 0
let height = 0
let running = false
let observer: ResizeObserver | undefined
let viewObserver: IntersectionObserver | undefined

function spawn(anywhere = false): Mote {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : height + 8,
    size: Math.random() < 0.72 ? 1 : 1.7,
    speed: 5 + Math.random() * 12,
    drift: (Math.random() - 0.5) * 4,
    alpha: 0.16 + Math.random() * 0.42,
  }
}

function sizeCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  width = Math.max(1, rect.width)
  height = Math.max(1, rect.height)
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (!motes.length) motes = Array.from({ length: COUNT }, () => spawn(true))
}

function paint() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#f2f0eb'
  for (const mote of motes) {
    ctx.globalAlpha = mote.alpha
    ctx.fillRect(mote.x, mote.y, mote.size, mote.size)
  }
  ctx.globalAlpha = 1
}

function tick(now: number) {
  if (!running) return
  if (now - lastFrame < 33) {
    frame = requestAnimationFrame(tick)
    return
  }
  const delta = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.033
  lastFrame = now
  for (const mote of motes) {
    mote.y -= mote.speed * delta
    mote.x += mote.drift * delta
    if (mote.y < -8 || mote.x < -8 || mote.x > width + 8) Object.assign(mote, spawn())
  }
  paint()
  frame = requestAnimationFrame(tick)
}

function start() {
  if (running || !motionEnabled.value || !inView.value || document.hidden) return
  running = true
  lastFrame = 0
  frame = requestAnimationFrame(tick)
}

function stop() {
  running = false
  cancelAnimationFrame(frame)
}

function handleVisibility() {
  if (document.hidden) stop()
  else start()
}

watch([motionEnabled, inView], () => {
  if (motionEnabled.value && inView.value) start()
  else stop()
})

onMounted(() => {
  sizeCanvas()
  paint()
  start()
  observer = new ResizeObserver(() => {
    sizeCanvas()
    paint()
  })
  if (canvasRef.value) {
    observer.observe(canvasRef.value)
    viewObserver = new IntersectionObserver(
      (entries) => {
        inView.value = entries.some((entry) => entry.isIntersecting)
      },
      { threshold: 0.05 },
    )
    viewObserver.observe(canvasRef.value)
  }
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  stop()
  observer?.disconnect()
  viewObserver?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibility)
  motes = []
  ctx = null
})
</script>

<template>
  <canvas ref="canvasRef" class="hero__dust" aria-hidden="true" />
</template>