import { reactive, watch } from 'vue'
import { useTheme } from './useTheme'

export const appearanceDefaults = {
  brightness: 100, veil: 56, blur: 2, showParticles: true, particleOpacity: 100,
  accent: '#de94b8', cardOpacity: 92, sidebarOpacity: 92, navOpacity: 25,
  footerOpacity: 0, radius: 15, borderWidth: 1, borderOpacity: 19,
}
export type Appearance = typeof appearanceDefaults
type NumberKey = Exclude<keyof Appearance, 'accent' | 'showParticles'>
export const appearanceRanges: Record<NumberKey, [number, number]> = {
  brightness: [40, 140], veil: [0, 85], blur: [0, 16], particleOpacity: [0, 100],
  cardOpacity: [0, 100], sidebarOpacity: [0, 100], navOpacity: [0, 100],
  footerOpacity: [0, 100], radius: [0, 32], borderWidth: [0, 3], borderOpacity: [0, 60],
}
const STORAGE_KEY = 'chibarie-appearance-v1'
const settings = reactive<Appearance>({ ...appearanceDefaults })
const mix = (a: number[], b: number[], weight: number) =>
  a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight))
const luminance = (color: number[]) => color.map(value => value / 255)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)

export function initAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const key of Object.keys(appearanceRanges) as NumberKey[]) {
      if (typeof saved?.[key] === 'number' && Number.isFinite(saved[key])) {
        const [min, max] = appearanceRanges[key]
        settings[key] = Math.max(min, Math.min(max, saved[key]))
      }
    }
    if (typeof saved?.showParticles === 'boolean') settings.showParticles = saved.showParticles
    if (typeof saved?.accent === 'string' && /^#[0-9a-f]{6}$/i.test(saved.accent)) settings.accent = saved.accent
  } catch { /* 无法读取本机设置时使用默认外观 */ }
  const { theme } = useTheme()
  watch([settings, theme], () => {
    const root = document.documentElement
    const values = {
      brightness: settings.brightness / 100, veil: settings.veil / 100, blur: `${settings.blur}px`,
      'particle-opacity': settings.particleOpacity / 100, particles: settings.showParticles ? 'visible' : 'hidden',
      'card-opacity': settings.cardOpacity / 100, 'sidebar-opacity': settings.sidebarOpacity / 100,
      'nav-opacity': settings.navOpacity / 100, 'footer-opacity': settings.footerOpacity / 100,
      radius: `${settings.radius}px`, 'border-width': `${settings.borderWidth}px`,
      'border-opacity': settings.borderOpacity / 100,
    }
    for (const [name, value] of Object.entries(values)) root.style.setProperty(`--appearance-${name}`, String(value))
    const light = theme.value === 'light'
    const base = settings.accent.slice(1).match(/../g)!.map(value => parseInt(value, 16))
    const surface = light ? [255, 255, 255] : [24, 33, 49]
    const target = light ? [31, 46, 69] : [255, 255, 255]
    let accessible = base
    for (let weight = 0; weight <= 1; weight += .05) {
      accessible = mix(base, target, weight)
      const a = luminance(accessible), b = luminance(surface)
      if ((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 5) break
    }
    const palette = light ? {
      200: accessible, 300: accessible, 400: accessible, 500: accessible,
      600: mix(accessible, target, .14), 700: mix(accessible, target, .28),
    } : {
      200: mix(accessible, target, .35), 300: mix(accessible, target, .18), 400: accessible,
      500: mix(accessible, [11, 16, 27], .1), 600: mix(accessible, [11, 16, 27], .22),
      700: mix(accessible, [11, 16, 27], .36),
    }
    for (const [level, color] of Object.entries(palette)) root.style.setProperty(`--c-sakura-${level}`, color.join(' '))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* 设置仍可在当前页面使用 */ }
  }, { deep: true, immediate: true })
}

export function useAppearance() {
  return { settings, reset: () => Object.assign(settings, appearanceDefaults) }
}
