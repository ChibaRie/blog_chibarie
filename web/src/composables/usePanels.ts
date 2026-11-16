import { ref } from 'vue'

/** 外观面板是全局单例，命令栏与面板共用同一份开关状态 */
const appearanceOpen = ref(false)

export function usePanels() {
  return {
    appearanceOpen,
    toggleAppearance: () => {
      appearanceOpen.value = !appearanceOpen.value
    },
    closeAppearance: () => {
      appearanceOpen.value = false
    },
  }
}