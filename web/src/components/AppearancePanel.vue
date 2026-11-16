<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { accentPresets, appearanceRanges, useAppearance } from '@/composables/useAppearance'
import { usePanels } from '@/composables/usePanels'
import { useTheme } from '@/composables/useTheme'

const { settings, reset } = useAppearance()
const { appearanceOpen, closeAppearance } = usePanels()
const { theme, set: setTheme } = useTheme()

const panelRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
const status = ref('')
let restoreFocus: HTMLElement | null = null

type RangeKey = 'artBrightness' | 'artVeil' | 'artBlur' | 'bodyScale'

const ranges: { key: RangeKey; label: string; unit: string }[] = [
  { key: 'artBrightness', label: '头图亮度', unit: '%' },
  { key: 'artVeil', label: '头图遮罩', unit: '%' },
  { key: 'artBlur', label: '头图模糊', unit: 'px' },
  { key: 'bodyScale', label: '正文字号', unit: '%' },
]

function onRangeInput(key: RangeKey, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) settings[key] = value
}

function restore() {
  reset()
  status.value = '已恢复默认外观。'
}

function handleOutside(event: PointerEvent) {
  if (!appearanceOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (panelRef.value?.contains(target)) return
  if (target instanceof Element && target.closest('[aria-controls="appearance-panel"]')) return
  closeAppearance()
}

function handleKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && appearanceOpen.value) {
    event.preventDefault()
    closeAppearance()
  }
}

watch(appearanceOpen, async (open) => {
  if (open) {
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    closeRef.value?.focus({ preventScroll: true })
    return
  }
  status.value = ''
  const target = restoreFocus
  restoreFocus = null
  if (target?.isConnected) target.focus({ preventScroll: true })
})

onMounted(() => {
  document.addEventListener('pointerdown', handleOutside)
  document.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutside)
  document.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <section
    v-if="appearanceOpen"
    id="appearance-panel"
    ref="panelRef"
    class="app-panel"
    data-open="true"
    role="dialog"
    aria-labelledby="appearance-title"
    @wheel.stop.passive
  >
    <header class="app-panel__head">
      <div class="app-panel__title">
        <b>// APPEARANCE</b>
        <h2 id="appearance-title">外观</h2>
      </div>
      <button ref="closeRef" type="button" class="app-close" aria-label="关闭外观设置" @click="closeAppearance">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </header>

    <div class="app-panel__body">
      <div class="app-group">
        <h3 class="app-group__title"><span>主题</span><b>THEME</b></h3>
        <div class="app-seg">
          <button type="button" :aria-pressed="theme === 'night'" @click="setTheme('night')">
            夜航<small>NIGHT</small>
          </button>
          <button type="button" :aria-pressed="theme === 'paper'" @click="setTheme('paper')">
            纸白<small>PAPER</small>
          </button>
        </div>
      </div>

      <div class="app-group">
        <h3 class="app-group__title"><span>强调色</span><b>SIGNAL</b></h3>
        <div class="app-swatches">
          <button
            v-for="preset in accentPresets"
            :key="preset.value"
            type="button"
            class="app-swatch"
            :style="{ '--swatch': preset.value }"
            :aria-label="`${preset.name}强调色`"
            :aria-pressed="settings.accent.toLowerCase() === preset.value"
            @click="settings.accent = preset.value"
          />
          <label class="app-custom" title="自定义强调色">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m14 5 5 5M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z" />
            </svg>
            <input
              v-model="settings.accent"
              type="color"
              aria-label="自定义强调色"
            />
          </label>
        </div>
        <p class="flex items-center justify-between text-[10px] tracking-[0.1em] text-white/40">
          <span>填充上的字会自动取对比度更高的颜色</span>
          <output class="font-mono text-white/60">{{ settings.accent.toUpperCase() }}</output>
        </p>
      </div>

      <div class="app-group">
        <h3 class="app-group__title"><span>首页头图</span><b>ARTWORK</b></h3>
        <label
          v-for="item in ranges.slice(0, 3)"
          :key="item.key"
          class="app-range"
        >
          <span class="app-range__row">
            <span>{{ item.label }}</span>
            <output>{{ settings[item.key] }}{{ item.unit }}</output>
          </span>
          <input
            type="range"
            :min="appearanceRanges[item.key][0]"
            :max="appearanceRanges[item.key][1]"
            :value="settings[item.key]"
            :aria-label="item.label"
            @input="onRangeInput(item.key, $event)"
          >
        </label>
      </div>

      <div class="app-group">
        <h3 class="app-group__title"><span>阅读</span><b>READING</b></h3>
        <label class="app-range">
          <span class="app-range__row">
            <span>正文字号</span>
            <output>{{ settings.bodyScale }}%</output>
          </span>
          <input
            type="range"
            :min="appearanceRanges.bodyScale[0]"
            :max="appearanceRanges.bodyScale[1]"
            step="1"
            :value="settings.bodyScale"
            aria-label="正文字号"
            @input="onRangeInput('bodyScale', $event)"
          >
        </label>
        <label class="app-switch">
          <span>界面动效</span>
          <input v-model="settings.motion" type="checkbox" role="switch" aria-label="界面动效">
          <span class="app-switch__track" aria-hidden="true" />
        </label>
        <p class="text-[10.5px] leading-relaxed text-white/40">
          系统开启「减少动态效果」时，动效会自动关闭。
        </p>
      </div>
    </div>

    <footer class="app-panel__foot">
      <span>仅保存在当前浏览器</span>
      <button type="button" class="app-reset" @click="restore">恢复默认</button>
    </footer>
    <p class="app-status" role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>