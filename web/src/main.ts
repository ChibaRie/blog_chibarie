import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import { initAppearance } from './composables/useAppearance'
import './styles/main.css'
import './styles/appearance.css'

initTheme()
initAppearance()

createApp(App).use(router).mount('#app')
