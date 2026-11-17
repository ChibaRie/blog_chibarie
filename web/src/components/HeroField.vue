<script setup lang="ts">
/**
 * 首屏三维光尘：three.js 点云，两层深度、指针视差、缓慢漂移。
 * 只做氛围，不承载信息；WebGL 不可用时退回 HeroDust 的 2D 光尘。
 * 离屏、页面隐藏、关闭动效时停止渲染；减少动效时只画一帧。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import HeroDust from '@/components/HeroDust.vue'
import { useMotion } from '@/composables/useMotion'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const failed = ref(false)
const { motionEnabled } = useMotion()

let disposed = false
let starting = false
let teardown: (() => void) | null = null
let syncMotionHook: (() => void) | null = null

const stopMotionWatch = watch(motionEnabled, () => syncMotionHook?.())

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

async function mount() {
  if (disposed || starting || failed.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  if (!supportsWebGL()) {
    failed.value = true
    return
  }

  starting = true
  try {
    const THREE = await import('three')
    if (disposed || !canvasRef.value) return
    teardown = createField(THREE, canvasRef.value)
  } catch {
    failed.value = true
  } finally {
    starting = false
  }
}

function createField(THREE: typeof import('three'), canvas: HTMLCanvasElement) {
  let renderer: import('three').WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
  } catch {
    failed.value = true
    return null
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80)
  camera.position.set(0, 0, 14)

  const group = new THREE.Group()
  scene.add(group)

  const width = Math.max(1, canvas.clientWidth || window.innerWidth)
  const density = width < 720 ? 340 : width < 1200 ? 620 : 900
  const positions = new Float32Array(density * 3)
  const colors = new Float32Array(density * 3)
  const sizes = new Float32Array(density)
  const phases = new Float32Array(density)

  const white = { r: 0.93, g: 0.91, b: 0.86 }
  const accent = { r: 1, g: 0.435, b: 0.647 }

  for (let index = 0; index < density; index += 1) {
    const offset = index * 3
    positions[offset] = (Math.random() - 0.5) * 26
    positions[offset + 1] = (Math.random() - 0.5) * 15
    positions[offset + 2] = -12 + Math.random() * 16

    const signal = Math.random() < 0.16
    const tint = signal ? accent : white
    const brightness = signal ? 0.85 + Math.random() * 0.15 : 0.4 + Math.random() * 0.6
    colors[offset] = tint.r * brightness
    colors[offset + 1] = tint.g * brightness
    colors[offset + 2] = tint.b * brightness

    sizes[index] = signal ? 1.6 + Math.random() * 2.4 : 0.5 + Math.random() * 1.5
    phases[index] = Math.random() * Math.PI * 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vGlow;

      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.12 + aPhase) * 0.5;
        p.y += cos(uTime * 0.16 + aPhase * 1.7) * 0.45;
        p.z += sin(uTime * 0.09 + aPhase * 0.7) * 0.4;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (22.0 / max(1.0, -mv.z));

        vColor = aColor;
        vGlow = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 0.5 + aPhase * 3.0));
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vGlow;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.02, length(uv)) * vGlow;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  })

  const points = new THREE.Points(geometry, material)
  group.add(points)

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6)
  renderer.setPixelRatio(pixelRatio)
  material.uniforms.uPixelRatio.value = pixelRatio
  renderer.outputColorSpace = THREE.SRGBColorSpace

  let time = 0
  let frame = 0
  let running = false
  let inView = true
  let last = 0
  let pointerX = 0
  let pointerY = 0
  let viewX = 0
  let viewY = 0
  let reduced = false

  function resize() {
    const box = canvas.getBoundingClientRect()
    const nextWidth = Math.max(1, Math.round(box.width))
    const nextHeight = Math.max(1, Math.round(box.height))
    renderer.setSize(nextWidth, nextHeight, false)
    camera.aspect = nextWidth / nextHeight
    camera.updateProjectionMatrix()
    if (!running) render()
  }

  function render() {
    material.uniforms.uTime.value = time
    camera.position.x = viewX * 1.3
    camera.position.y = -viewY * 0.9
    camera.lookAt(0, 0, 0)
    group.rotation.y = -viewX * 0.12 + time * 0.009
    group.rotation.x = viewY * 0.06
    renderer.render(scene, camera)
  }

  function tick(now: number) {
    if (!running) return
    if (now - last < 22) {
      frame = requestAnimationFrame(tick)
      return
    }
    const delta = last ? Math.min(0.05, (now - last) / 1000) : 0.022
    last = now
    time += delta
    viewX += (pointerX - viewX) * 0.045
    viewY += (pointerY - viewY) * 0.045
    render()
    frame = requestAnimationFrame(tick)
  }

  function start() {
    if (running || reduced) return
    if (!inView || document.hidden) return
    running = true
    last = 0
    frame = requestAnimationFrame(tick)
  }

  function stop() {
    running = false
    cancelAnimationFrame(frame)
  }

  function handlePointer(event: PointerEvent) {
    if (event.pointerType === 'touch') return
    pointerX = (event.clientX / window.innerWidth - 0.5) * 2
    pointerY = (event.clientY / window.innerHeight - 0.5) * 2
  }

  function handleVisibility() {
    if (document.hidden) stop()
    else start()
  }

  function handleContextLost(event: Event) {
    event.preventDefault()
    stop()
    failed.value = true
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)

  const viewObserver = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting)
      if (inView) start()
      else stop()
    },
    { threshold: 0.02 },
  )
  viewObserver.observe(canvas)

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const syncReduced = () => {
    reduced = reduceQuery.matches || !motionEnabled.value
    if (reduced) {
      stop()
      render()
    } else {
      start()
    }
  }
  syncReduced()
  syncMotionHook = syncReduced

  window.addEventListener('pointermove', handlePointer, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  canvas.addEventListener('webglcontextlost', handleContextLost)

  resize()

  return () => {
    stop()
    if (syncMotionHook === syncReduced) syncMotionHook = null
    resizeObserver.disconnect()
    viewObserver.disconnect()
    window.removeEventListener('pointermove', handlePointer)
    document.removeEventListener('visibilitychange', handleVisibility)
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    points.removeFromParent()
    group.clear()
  }
}

onMounted(() => {
  void mount()
})

onUnmounted(() => {
  disposed = true
  teardown?.()
  teardown = null
  syncMotionHook = null
  stopMotionWatch()
})

watch(failed, (value) => {
  if (!value) return
  teardown?.()
  teardown = null
})
</script>

<template>
  <HeroDust v-if="failed" />
  <canvas v-else ref="canvasRef" class="hero__dust hero__dust--field" aria-hidden="true" />
</template>
