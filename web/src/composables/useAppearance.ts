import { reactive, watch } from 'vue'
import { useTheme } from './useTheme'

export interface AppearanceState {
  accent: string
  artBrightness: number
  artVeil: number
  artBlur: number
  bodyScale: number
  motion: boolean
}

export const appearanceDefaults: AppearanceState = {
  accent: '#ff6fa5',
  artBrightness: 100,
  artVeil: 32,
  artBlur: 0,
  bodyScale: 100,
  motion: true,
}

export const appearanceRanges = {
  artBrightness: [60, 140],
  artVeil: [0, 80],
  artBlur: [0, 12],
  bodyScale: [100, 115],
} as const

export const accentPresets = [
  { name: '樱粉', value: '#ff6fa5' },
  { name: '信号黄', value: '#ffe14d' },
  { name: '青瓷', value: '#5fe3cf' },
  { name: '夜蓝', value: '#7fa6ff' },
] as const

const STORAGE_KEY = 'chibarie-appearance-v2'
const settings = reactive<AppearanceState>({ ...appearanceDefaults })

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return null
  const value = match[1]
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function channels(color: Rgb): string {
  return color.map((value) => Math.round(value)).join(' ')
}

function mix(a: Rgb, b: Rgb, weight: number): Rgb {
  return [0, 1, 2].map((i) => a[i] * (1 - weight) + b[i] * weight) as Rgb
}

function luminance(color: Rgb): number {
  const linear = color
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 强调色填充上的字：自动取对比度更高的墨色或纸白 */
function inkOn(accent: Rgb): Rgb {
  const dark: Rgb = [12, 12, 14]
  const light: Rgb = [242, 240, 235]
  return contrast(accent, dark) >= contrast(accent, light) ? dark : light
}

/** 强调色当小字用时，朝当前主题的底色方向调整到 AA */
function textOn(accent: Rgb, paper: Rgb, isPaper: boolean): Rgb {
  if (contrast(accent, paper) >= 4.5) return accent
  const target: Rgb = isPaper ? [0, 0, 0] : [255, 255, 255]
  let result = accent
  for (let weight = 0; weight <= 1.0001; weight += 0.04) {
    result = mix(accent, target, weight)
    if (contrast(result, paper) >= 4.5) break
  }
  return result
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

export function initAppearance(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<AppearanceState>
    if (typeof saved.accent === 'string' && parseHex(saved.accent)) settings.accent = saved.accent
    if (typeof saved.motion === 'boolean') settings.motion = saved.motion
    for (const key of Object.keys(appearanceRanges) as (keyof typeof appearanceRanges)[]) {
      const [min, max] = appearanceRanges[key]
      settings[key] = clampNumber(saved[key], min, max, appearanceDefaults[key])
    }
  } catch {
    // 读不到设置时用默认外观
  }

  const { theme } = useTheme()

  watch(
    [settings, theme],
    () => {
      const root = document.documentElement
      const accent = parseHex(settings.accent) ?? [255, 111, 165]
      const isPaper = theme.value === 'paper'
      const paper: Rgb = isPaper ? [244, 243, 240] : [10, 10, 12]

      root.style.setProperty('--c-accent', channels(accent))
      root.style.setProperty('--c-accent-ink', channels(inkOn(accent)))
      root.style.setProperty('--c-accent-text', channels(textOn(accent, paper, isPaper)))
      root.style.setProperty('--app-art-brightness', String(settings.artBrightness / 100))
      root.style.setProperty('--app-art-veil', String(settings.artVeil / 100))
      root.style.setProperty('--app-art-blur', `${settings.artBlur}px`)
      root.style.setProperty('--app-body-scale', String(settings.bodyScale / 100))
      root.setAttribute('data-motion', settings.motion ? 'on' : 'off')

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // 设置仍可在当前页面使用
      }
    },
    { deep: true, immediate: true },
  )
}

export function useAppearance() {
  return {
    settings,
    reset: () => Object.assign(settings, appearanceDefaults),
  }
}