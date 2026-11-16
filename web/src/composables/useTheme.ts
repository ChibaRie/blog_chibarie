import { nextTick, readonly, ref } from 'vue'

export type Theme = 'night' | 'paper'

const STORAGE_KEY = 'chibarie-theme'

/** 模块级单例：所有组件共享同一份主题状态 */
const theme = ref<Theme>('night')

function storedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'paper' || saved === 'light' ? 'paper' : 'night'
  } catch {
    return 'night'
  }
}

function apply(next: Theme): void {
  document.documentElement.setAttribute('data-theme', next)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', next === 'paper' ? '#f4f3f0' : '#0a0a0c')
}

/** 应用启动时调用一次。index.html 的内联脚本做同样的判断，两处必须一致。 */
export function initTheme(): void {
  theme.value = storedTheme()
  apply(theme.value)
}

export function useTheme() {
  function set(next: Theme): void {
    if (theme.value === next) return
    theme.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式下无法写入时，当前页面内仍然生效
    }
    apply(next)
  }

  /**
   * 从点击位置向外扩散揭开新主题。浏览器不支持或系统减少动效时直接切换，
   * 由 base.css 里 html/body 的颜色过渡兜底。
   */
  function toggle(event?: MouseEvent): void {
    const next: Theme = theme.value === 'night' ? 'paper' : 'night'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const off = document.documentElement.getAttribute('data-motion') === 'off'

    if (typeof document.startViewTransition !== 'function' || reduced || off) {
      set(next)
      return
    }

    if (event) {
      document.documentElement.style.setProperty('--theme-x', `${event.clientX}px`)
      document.documentElement.style.setProperty('--theme-y', `${event.clientY}px`)
    }

    document.startViewTransition(async () => {
      set(next)
      await nextTick()
    })
  }

  return { theme: readonly(theme), set, toggle }
}