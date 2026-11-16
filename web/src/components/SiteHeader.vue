<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { usePanels } from '@/composables/usePanels'
import { useSite } from '@/composables/useSite'

const route = useRoute()
const { theme, toggle } = useTheme()
const { appearanceOpen, toggleAppearance } = usePanels()
const { siteInfo } = useSite()

const navs = [
  { name: 'home', cn: '首页', en: 'HOME', to: '/' },
  { name: 'notes', cn: '说说', en: 'LOG', to: '/notes' },
  { name: 'gallery', cn: '图库', en: 'STILLS', to: '/gallery' },
  { name: 'archive', cn: '归档', en: 'ARCHIVE', to: '/archive' },
  { name: 'categories', cn: '分类', en: 'SECTIONS', to: '/categories' },
  { name: 'about', cn: '关于', en: 'ABOUT', to: '/about' },
]

const menuNavs = [
  navs[0],
  navs[1],
  navs[2],
  navs[3],
  navs[4],
  { name: 'tags', cn: '标签', en: 'TAGS', to: '/tags' },
  { name: 'links', cn: '友链', en: 'LINKS', to: '/links' },
  navs[5],
]

const menuSummary = computed(() => {
  const stats = siteInfo.value?.stats
  return stats ? `${stats.postCount} 篇文章 · ${stats.galleryCount} 张图版` : ''
})
const isPaper = computed(() => theme.value === 'paper')
const themeLabel = computed(() => (isPaper.value ? '切换到夜航主题' : '切换到纸白主题'))
const solid = computed(() => route.name !== 'home' || scrolled.value)

const scrolled = ref(false)
const menuOpen = ref(false)
const menuRef = ref<HTMLDialogElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)

function handleScroll() {
  scrolled.value = window.scrollY > 16
}

function openMenu() {
  const dialog = menuRef.value
  if (!dialog || dialog.open) return
  dialog.showModal()
  menuOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeMenu() {
  menuRef.value?.close()
}

function handleMenuClose() {
  menuOpen.value = false
  document.body.style.overflow = ''
  menuButton.value?.focus({ preventScroll: true })
}

watch(
  () => route.fullPath,
  () => {
    if (menuRef.value?.open) closeMenu()
  },
)

watch(menuOpen, (open) => {
  if (!open && document.body.style.overflow === 'hidden') document.body.style.overflow = ''
})

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (menuRef.value?.open) menuRef.value.close()
  document.body.style.overflow = ''
})
</script>

<template>
  <header class="cmd-bar" :data-solid="solid ? 'true' : 'false'">
    <div class="cmd-bar__scrim" aria-hidden="true" />
    <div class="cmd-bar__inner shell">
      <RouterLink to="/" class="cmd-brand" aria-label="chibarie 首页">
        <svg class="cmd-brand__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <path d="M3 8.5V3h5.5M15.5 3H21v5.5M21 15.5V21h-5.5M8.5 21H3v-5.5" />
          <rect x="9.2" y="9.2" width="5.6" height="5.6" fill="currentColor" stroke="none" />
        </svg>
        <span class="cmd-brand__text">
          <span class="cmd-brand__name">chibarie</span>
          <span class="cmd-brand__sub">Archive</span>
        </span>
      </RouterLink>

      <nav class="cmd-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navs"
          :key="item.name"
          :to="item.to"
          class="cmd-nav__link"
          :aria-current="route.name === item.name ? 'page' : undefined"
        >
          <span class="cmd-nav__en" aria-hidden="true">{{ item.en }}</span>
          <span class="cmd-nav__cn">{{ item.cn }}</span>
        </RouterLink>
      </nav>

      <div class="cmd-tools">
        <RouterLink to="/search" class="cmd-tool" aria-label="搜索" title="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </RouterLink>

        <button
          type="button"
          class="cmd-tool"
          :aria-label="themeLabel"
          :title="themeLabel"
          :aria-pressed="isPaper"
          @click="toggle"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <circle cx="12" cy="12" r="8.4" />
            <path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <button
          type="button"
          class="cmd-tool"
          :aria-label="appearanceOpen ? '关闭外观设置' : '打开外观设置'"
          aria-controls="appearance-panel"
          :aria-expanded="appearanceOpen"
          title="外观设置"
          @click="toggleAppearance"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 7h7m5 0h4M4 17h3m5 0h8" />
            <rect x="12.4" y="4.6" width="4.2" height="4.8" />
            <rect x="7.4" y="14.6" width="4.2" height="4.8" />
          </svg>
        </button>

        <button
          ref="menuButton"
          type="button"
          class="cmd-tool cmd-tool--menu"
          :aria-label="menuOpen ? '关闭菜单' : '打开菜单'"
          aria-controls="site-menu"
          :aria-expanded="menuOpen"
          @click="openMenu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </div>
  </header>

  <dialog
    id="site-menu"
    ref="menuRef"
    class="menu-sheet"
    aria-label="站点导航"
    @close="handleMenuClose"
  >
    <div class="menu-sheet__bar">
      <span class="cmd-brand" aria-hidden="true">
        <span class="cmd-brand__text">
          <span class="cmd-brand__name">chibarie</span>
          <span class="cmd-brand__sub">Archive</span>
        </span>
      </span>
      <button type="button" class="cmd-tool" aria-label="关闭菜单" autofocus @click="closeMenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </div>

    <nav class="menu-sheet__body" aria-label="站点导航">
      <RouterLink
        v-for="(item, index) in menuNavs"
        :key="item.name"
        :to="item.to"
        class="menu-sheet__item"
        :style="{ '--i': index }"
        :aria-current="route.name === item.name ? 'page' : undefined"
        @click="closeMenu"
      >
        <span class="menu-sheet__no" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="menu-sheet__cn">{{ item.cn }}</span>
        <span class="menu-sheet__en" aria-hidden="true">{{ item.en }}</span>
      </RouterLink>
    </nav>

    <div class="menu-sheet__foot">
      <span>chibarie · 个人档案<template v-if="menuSummary"> · {{ menuSummary }}</template></span>
      <span>{{ new Date().getFullYear() }}</span>
    </div>
  </dialog>
</template>