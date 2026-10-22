import { nextTick, readonly, ref } from 'vue'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'chibarie-theme'

/** 模块级单例：所有组件共享同一份主题状态 */
const theme = ref<Theme>('dark')

function apply(next: Theme) {
  document.documentElement.classList.toggle('light', next === 'light')
  // 移动端浏览器地址栏配色跟随主题
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', next === 'light' ? '#f6f3f9' : '#0d0a1a')
}

/** View Transitions API 目前 TS 的 lib 里还没有，自己声明用到的最小面 */
type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => unknown
}

/**
 * 应用启动时调用一次。
 *
 * 默认暗色：站点的视觉基调是暗色星空插画，日间模式是访客主动选择的能力。
 * 若改为「首次访问跟随系统」，把下面的分支换成 matchMedia 判断即可
 * （注意同时要改 index.html 里防闪烁的内联脚本，两处必须一致，否则会闪一下）。
 */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    theme.value = saved
  }
  apply(theme.value)
}

export function useTheme() {
  function set(next: Theme) {
    if (theme.value === next) return
    theme.value = next
    localStorage.setItem(STORAGE_KEY, next)
    apply(next)
  }

  /**
   * 切换主题。传入手势坐标时，用 View Transitions API 做一圈从点击处
   * 向外扩散的「渐变边缘圆形揭示」；浏览器不支持或系统开了减弱动效
   * 就直接切换，靠 main.css 里 html/body 的 0.32s 颜色过渡兜底。
   */
  function toggle(event?: MouseEvent) {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    const doc = document as TransitionDocument

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || reduced) {
      set(next)
      return
    }

    const root = document.documentElement
    if (event) {
      root.style.setProperty('--theme-x', `${event.clientX}px`)
      root.style.setProperty('--theme-y', `${event.clientY}px`)
    }

    doc.startViewTransition(async () => {
      set(next)
      // 等 Vue 把 DOM 更新完再截「新状态」，否则截到的还是旧颜色
      await nextTick()
    })
  }

  return { theme: readonly(theme), toggle }
}
