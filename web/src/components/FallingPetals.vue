<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  rotation: number
  rotationSpeed: number
  sway: number
  swaySpeed: number
  swayPhase: number
  opacity: number
  kind: 'petal' | 'spark'
  color: string
}

const DEFAULT_PETAL_COLORS = ['#f0c4de', '#e8a8cc', '#d98cb8', '#f6d9e8', '#cdb4e8']

/** 花瓣配色随主题变化，从 CSS 变量读取（亮底需要更浓的花瓣色） */
let petalColors = [...DEFAULT_PETAL_COLORS]
let sparkColor = '#ffffff'

function readThemeColors() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim()
    return v ? `rgb(${v})` : fallback
  }
  petalColors = [
    read('--petal-1', DEFAULT_PETAL_COLORS[0]),
    read('--petal-2', DEFAULT_PETAL_COLORS[1]),
    read('--petal-3', DEFAULT_PETAL_COLORS[2]),
    read('--petal-4', DEFAULT_PETAL_COLORS[3]),
    read('--petal-5', DEFAULT_PETAL_COLORS[4]),
  ]
  sparkColor = read('--petal-spark', '#ffffff')
}

/** 主题切换后按新配色重染存量粒子，无需等它们自然消亡 */
function recolorParticles() {
  readThemeColors()
  particles = particles.map((p) => ({
    ...p,
    color:
      p.kind === 'petal'
        ? petalColors[Math.floor(Math.random() * petalColors.length)]
        : sparkColor,
  }))
}

const themeObserver = new MutationObserver(recolorParticles)

let particles: Particle[] = []
let rafId = 0
let ctx: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let lastTime = 0
let active = true
let reduced = false

function makeParticle(initial: boolean): Particle {
  const kind: Particle['kind'] = Math.random() < 0.82 ? 'petal' : 'spark'
  const isPetal = kind === 'petal'

  return {
    x: Math.random() * width,
    y: initial ? Math.random() * height : -24,
    size: isPetal ? 5 + Math.random() * 6 : 1 + Math.random() * 1.6,
    speedY: isPetal ? 11 + Math.random() * 20 : 5 + Math.random() * 9,
    speedX: -7 + Math.random() * 14,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (-0.6 + Math.random() * 1.2) * 0.7,
    sway: 12 + Math.random() * 26,
    swaySpeed: 0.3 + Math.random() * 0.7,
    swayPhase: Math.random() * Math.PI * 2,
    opacity: isPetal
      ? 0.32 + Math.random() * 0.38
      : 0.22 + Math.random() * 0.4,
    kind,
    color: isPetal
      ? petalColors[Math.floor(Math.random() * petalColors.length)]
      : sparkColor,
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return

  readThemeColors()

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight

  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  const target = Math.round(
    Math.min(58, Math.max(14, (width * height) / 26000)),
  )
  if (particles.length > target) {
    particles = particles.slice(0, target)
  } else {
    while (particles.length < target) {
      particles.push(makeParticle(true))
    }
  }
}

function drawPetal(p: Particle) {
  if (!ctx) return
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = p.opacity
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.ellipse(0, 0, p.size * 0.62, p.size, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpark(p: Particle) {
  if (!ctx) return
  ctx.save()
  ctx.globalAlpha = p.opacity
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function frame(time: number) {
  if (!active || !ctx) return

  const dt = Math.min((time - lastTime) / 1000, 0.05)
  lastTime = time

  ctx.clearRect(0, 0, width, height)

  for (const p of particles) {
    p.swayPhase += p.swaySpeed * dt
    p.y += p.speedY * dt
    p.x += (p.speedX + Math.sin(p.swayPhase) * p.sway) * dt
    p.rotation += p.rotationSpeed * dt

    if (p.y > height + 30 || p.x < -60 || p.x > width + 60) {
      Object.assign(p, makeParticle(false))
    }

    if (p.kind === 'petal') drawPetal(p)
    else drawSpark(p)
  }

  rafId = requestAnimationFrame(frame)
}

function handleVisibility() {
  if (document.hidden) {
    active = false
    cancelAnimationFrame(rafId)
  } else if (!reduced) {
    active = true
    lastTime = performance.now()
    rafId = requestAnimationFrame(frame)
  }
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return

  resize()
  active = true
  lastTime = performance.now()
  rafId = requestAnimationFrame(frame)

  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', handleVisibility)
  // 主题切换后清空存量粒子，让它们按新配色重新生成
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onUnmounted(() => {
  active = false
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibility)
  themeObserver.disconnect()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 z-[5]"
    aria-hidden="true"
  />
</template>
