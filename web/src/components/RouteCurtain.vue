<script setup lang="ts">
/**
 * 路由幕布：斜切面板扫入，HUD 显示目标栏目的编号、英文与中文。
 * 面板只做过渡遮挡，不承载内容；动效关闭时不接管任何路由。
 */
import { onUnmounted, reactive, ref } from 'vue'
import { useRouter, type RouteLocationNormalized } from 'vue-router'
import { useMotion } from '@/composables/useMotion'

type Phase = 'idle' | 'out' | 'in'

interface Plate {
  code: string
  en: string
  cn: string
}

const PLATES: Record<string, Plate> = {
  home: { code: '01', en: 'Home', cn: '首页' },
  notes: { code: '02', en: 'Log', cn: '说说' },
  gallery: { code: '03', en: 'Stills', cn: '图库' },
  archive: { code: '04', en: 'Archive', cn: '归档' },
  categories: { code: '05', en: 'Sections', cn: '分类' },
  tags: { code: '06', en: 'Tags', cn: '标签' },
  links: { code: '07', en: 'Links', cn: '友链' },
  about: { code: '08', en: 'About', cn: '关于' },
  search: { code: '09', en: 'Search', cn: '搜索' },
  post: { code: '10', en: 'Record', cn: '文章' },
  'not-found': { code: '00', en: 'Lost', cn: '未找到' },
}

const BANDS = 6
const MIN_OUT = 330
const LEAVE = 370

const router = useRouter()
const { motionEnabled } = useMotion()

const phase = ref<Phase>('idle')
const plate = reactive<Plate>({ code: '01', en: 'Home', cn: '首页' })
let navigating = false
let startedAt = 0
let leaveTimer = 0
let idleTimer = 0
let resetFrame = 0

function plateFor(to: RouteLocationNormalized): Plate {
  const base = PLATES[String(to.name ?? '')] ?? { code: '00', en: 'Index', cn: '档案' }
  if (to.name === 'post') {
    const slug = String(to.params.slug ?? '')
    return { ...base, en: slug ? `Record / ${slug}` : base.en }
  }
  return base
}

function clearTimers() {
  window.clearTimeout(leaveTimer)
  window.clearTimeout(idleTimer)
  cancelAnimationFrame(resetFrame)
}

function enterCurtain(to: RouteLocationNormalized) {
  clearTimers()
  navigating = true
  startedAt = performance.now()
  Object.assign(plate, plateFor(to))

  if (phase.value === 'idle') {
    phase.value = 'out'
    return
  }

  // 上一段还没结束：先无动画复位到屏外，再扫入，避免面板从右侧穿回来。
  phase.value = 'idle'
  resetFrame = requestAnimationFrame(() => {
    resetFrame = requestAnimationFrame(() => {
      if (navigating) phase.value = 'out'
    })
  })
}

function leaveCurtain() {
  if (!navigating || !motionEnabled.value) {
    phase.value = 'idle'
    navigating = false
    return
  }
  const wait = Math.max(0, MIN_OUT - (performance.now() - startedAt))
  leaveTimer = window.setTimeout(() => {
    if (!navigating) return
    phase.value = 'in'
    idleTimer = window.setTimeout(() => {
      phase.value = 'idle'
      navigating = false
    }, LEAVE)
  }, wait)
}

const offBefore = router.beforeEach((to, from) => {
  if (!motionEnabled.value || !from.name || to.path === from.path) return
  enterCurtain(to)
})

const offAfter = router.afterEach(() => leaveCurtain())

onUnmounted(() => {
  clearTimers()
  offBefore()
  offAfter()
})
</script>

<template>
  <div class="route-curtain" :data-phase="phase" aria-hidden="true">
    <div
      v-for="index in BANDS"
      :key="index"
      class="route-curtain__band"
      :style="{ '--i': index - 1 }"
    />
    <span class="route-curtain__scan" />
    <div class="route-curtain__hud">
      <span class="route-curtain__code">// {{ plate.code }}</span>
      <span class="route-curtain__en">{{ plate.en }}</span>
      <span class="route-curtain__cn">{{ plate.cn }}</span>
      <span class="route-curtain__track"><i /></span>
    </div>
  </div>
</template>
