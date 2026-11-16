/**
 * 动效偏好：站内开关 + 系统「减少动态效果」。
 *
 * 之前这里只提供一次性判断，环境动效在挂载/启动后就不再读偏好；
 * 现在改成响应式状态，HomeView / HeroDust 监听它，关掉时真的停。
 */
import { computed, readonly, ref } from 'vue'
import { useAppearance } from './useAppearance'

const mediaQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

const systemReduced = ref(mediaQuery?.matches ?? false)
mediaQuery?.addEventListener('change', (event) => {
  systemReduced.value = event.matches
})

const { settings } = useAppearance()
const allowed = computed(() => settings.motion && !systemReduced.value)

export function prefersReducedMotion(): boolean {
  return systemReduced.value
}

export function motionAllowed(): boolean {
  return allowed.value
}

/** 消费方监听 motionEnabled，即可在开关/系统偏好变化时停止或恢复动效。 */
export function useMotion() {
  return {
    motionEnabled: readonly(allowed),
    systemReduced: readonly(systemReduced),
  }
}

/** 数字落定：把每一位在 0-9 之间滚动后锁定，只在允许动效时执行。 */
export function settleNumber(
  target: number,
  apply: (value: number) => void,
  options: { duration?: number; decimals?: number } = {},
): () => void {
  const duration = options.duration ?? 600
  const decimals = options.decimals ?? 0
  if (!motionAllowed()) {
    apply(target)
    return () => {}
  }

  let frame = 0
  let start = 0
  const factor = 10 ** decimals

  const tick = (now: number) => {
    if (!start) start = now
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - (1 - progress) ** 3
    if (progress < 1) {
      const noise = (Math.random() * 0.55 + 0.45) * target
      const value = Math.round((target * eased + noise * (1 - eased)) * factor) / factor
      apply(Math.min(target, Math.max(0, value)))
      frame = requestAnimationFrame(tick)
      return
    }
    apply(target)
  }

  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}