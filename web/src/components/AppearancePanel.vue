<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { appearanceRanges, useAppearance } from '@/composables/useAppearance'

const { settings, reset } = useAppearance()
const open = ref(false)
const status = ref('')
const toggleRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
type NumberKey = keyof typeof appearanceRanges
interface Control { key: NumberKey; label: string; unit?: string; step?: number }
const groups: { id: string; title: string; controls: Control[] }[] = [
  { id: 'background', title: '背景', controls: [
    { key: 'brightness', label: '背景亮度' }, { key: 'veil', label: '背景遮罩' },
    { key: 'blur', label: '背景模糊', unit: 'px' },
  ] },
  { id: 'particles', title: '粒子效果', controls: [{ key: 'particleOpacity', label: '粒子浓淡' }] },
  { id: 'color', title: '主题强调色', controls: [] },
  { id: 'opacity', title: '框体不透明度', controls: [
    { key: 'cardOpacity', label: '内容卡片' }, { key: 'sidebarOpacity', label: '右侧栏卡片' },
    { key: 'navOpacity', label: '滚动后的导航栏' }, { key: 'footerOpacity', label: '页脚' },
  ] },
  { id: 'edges', title: '圆角与描边', controls: [
    { key: 'radius', label: '卡片圆角', unit: 'px' },
    { key: 'borderWidth', label: '描边粗细', unit: 'px', step: .5 },
    { key: 'borderOpacity', label: '描边明显度' },
  ] },
]
const presets = [
  { name: '樱粉', color: '#de94b8' }, { name: '晴蓝', color: '#8fb6f5' },
  { name: '雾紫', color: '#b5a0e2' }, { name: '薄荷', color: '#84c7b4' },
]
function setNumber(key: NumberKey, event: Event) {
  settings[key] = Number((event.target as HTMLInputElement).value)
}
async function setOpen(value: boolean) {
  open.value = value
  await nextTick()
  ;(value ? closeRef.value : toggleRef.value)?.focus({ preventScroll: true })
}
function handleOutside(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !panelRef.value?.contains(target) && !toggleRef.value?.contains(target)) void setOpen(false)
}
function handleKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) { event.preventDefault(); void setOpen(false) }
}
function restore() { reset(); status.value = '已恢复默认外观。' }
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
  <button ref="toggleRef" class="appearance-toggle" type="button"
    :aria-label="open ? '关闭外观设置' : '打开外观设置'" aria-controls="appearance-panel"
    :aria-expanded="open" title="外观设置" @click="setOpen(!open)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path v-if="open" d="m6 6 12 12M6 18 18 6" />
      <template v-else><path d="M4 7h7m6 0h3M4 17h3m6 0h7" /><circle cx="14" cy="7" r="3" /><circle cx="10" cy="17" r="3" /></template>
    </svg>
  </button>
  <section v-show="open" id="appearance-panel" ref="panelRef" class="appearance-panel"
    role="dialog" aria-labelledby="appearance-title" @wheel.stop.passive>
    <header class="appearance-panel-header">
      <div><h2 id="appearance-title">外观设置</h2><p>调成你喜欢的样子</p></div>
      <button ref="closeRef" type="button" class="appearance-close" aria-label="关闭外观设置" @click="setOpen(false)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <div class="appearance-body">
      <section v-for="group in groups" :key="group.id" class="appearance-group" :aria-labelledby="`appearance-${group.id}-title`">
        <h3 :id="`appearance-${group.id}-title`">{{ group.title }}</h3>
        <label v-if="group.id === 'particles'" class="appearance-switch">
          <span>显示花瓣与星点</span><input v-model="settings.showParticles" type="checkbox" role="switch" aria-label="显示花瓣与星点">
        </label>
        <template v-if="group.id === 'color'">
          <div class="appearance-presets">
            <button v-for="preset in presets" :key="preset.color" type="button" class="appearance-swatch"
              :style="{ '--swatch': preset.color }" :aria-label="`${preset.name}主题色`"
              :aria-pressed="settings.accent === preset.color" @click="settings.accent = preset.color">
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 12 4 4 8-8" /></svg></span>
            </button>
            <label class="appearance-custom-color" title="自定义主题色">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5 5 5M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z" /></svg>
              <input v-model="settings.accent" type="color" aria-label="自定义主题色">
            </label>
          </div>
          <p class="appearance-palette-caption"><span>预设配色 / 自定义</span><output>{{ settings.accent.toUpperCase() }}</output></p>
        </template>
        <label v-for="control in group.controls" :key="control.key" class="appearance-range">
          <span class="appearance-label-row"><span>{{ control.label }}</span><output :for="`appearance-${control.key}`">{{ settings[control.key] }}{{ control.unit || '%' }}</output></span>
          <input :id="`appearance-${control.key}`" type="range" :value="settings[control.key]"
            :min="appearanceRanges[control.key][0]" :max="appearanceRanges[control.key][1]"
            :step="control.step || 1" :aria-label="control.label"
            :disabled="control.key === 'particleOpacity' && !settings.showParticles" @input="setNumber(control.key, $event)">
        </label>
      </section>
    </div>
    <footer class="appearance-panel-footer"><span>仅保存在当前浏览器</span><button type="button" class="appearance-reset" @click="restore">恢复默认</button></footer>
    <p class="appearance-status" role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>

<style src="../styles/appearance-panel.css"></style>
