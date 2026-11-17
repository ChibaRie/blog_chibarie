import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme'
import { initAppearance } from './composables/useAppearance'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/hero.css'
import './styles/stills.css'
import './styles/article-page.css'
import './styles/pages.css'
import './styles/article.css'
import './styles/viewer.css'
import './styles/route.css'
import './styles/appearance.css'

initTheme()
initAppearance()

createApp(App).use(router).mount('#app')