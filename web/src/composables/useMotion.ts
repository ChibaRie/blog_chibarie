/** 系统减少动态效果 + 站点外观开关，任何脚本动效都先问这里。 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function motionAllowed(): boolean {
  if (prefersReducedMotion()) return false
  return document.documentElement.getAttribute('data-motion') !== 'off'
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