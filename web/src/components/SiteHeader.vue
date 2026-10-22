<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSite } from '@/composables/useSite'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const { siteInfo } = useSite()
const { theme, toggle } = useTheme()

const isLight = computed(() => theme.value === 'light')
const themeLabel = computed(() =>
  isLight.value ? '切换到夜间模式' : '切换到日间模式',
)

const scrolled = ref(false)
const mobileOpen = ref(false)

const navs = [
  { name: 'home', label: '首页', to: '/' },
  { name: 'notes', label: '说说', to: '/notes' },
  { name: 'archive', label: '归档', to: '/archive' },
  { name: 'categories', label: '分类', to: '/categories' },
  { name: 'links', label: '友链', to: '/links' },
  { name: 'about', label: '关于', to: '/about' },
]

const siteName = computed(() => siteInfo.value?.site.name || 'chibarie')

function handleScroll() {
  scrolled.value = window.scrollY > 20
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header
    class="sticky top-0 z-50 transition-all duration-300"
    :class="
      scrolled
        ? 'border-b border-mist-400/10 bg-night-950/78 backdrop-blur-xl'
        : 'border-b border-transparent bg-gradient-to-b from-night-950/42 to-transparent'
    "
  >
    <div
      class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
    >
        <RouterLink to="/" class="group flex items-center gap-2.5">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          class="transition-transform duration-500 group-hover:rotate-90"
        >
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style="stop-color: rgb(var(--c-sakura-200))" />
              <stop offset="100%" style="stop-color: rgb(var(--c-cosmos-400))" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.8 L14.55 9.15 L22 12 L14.55 14.85 L12 22.2 L9.45 14.85 L2 12 L9.45 9.15 Z"
            fill="url(#logoGrad)"
          />
        </svg>
        <span class="text-base font-medium tracking-wide text-mist-100">
          {{ siteName }}
        </span>
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="item in navs"
          :key="item.name"
          :to="item.to"
          class="nav-link"
          :class="{ 'nav-link-active': route.name === item.name }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-1.5">
        <RouterLink
          to="/search"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-sakura-500/12 hover:text-sakura-200"
          aria-label="搜索"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20 L16.65 16.65" />
          </svg>
        </RouterLink>

        <button
          type="button"
          class="theme-toggle flex h-9 w-9 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-sakura-500/12 hover:text-sakura-200"
          :aria-label="themeLabel"
          :title="themeLabel"
          :aria-pressed="isLight"
          @click="toggle"
        >
          <span class="theme-icon" :class="{ 'is-light': isLight }">
            <!-- 月亮：夜间模式当前状态 -->
            <svg
              class="theme-icon-moon"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <!-- 太阳：日间模式当前状态 -->
            <svg
              class="theme-icon-sun"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4.2" />
              <path
                d="M12 2.4v2.2M12 19.4v2.2M4.6 4.6l1.56 1.56M17.84 17.84l1.56 1.56M2.4 12h2.2M19.4 12h2.2M6.16 17.84L4.6 19.4M19.4 4.6l-1.56 1.56"
              />
            </svg>
          </span>
        </button>

        <button
          class="flex h-9 w-9 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-sakura-500/12 hover:text-sakura-200 md:hidden"
          :aria-label="mobileOpen ? '收起菜单' : '展开菜单'"
          @click="mobileOpen = !mobileOpen"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <template v-if="mobileOpen">
              <path d="M6 6 L18 18" />
              <path d="M18 6 L6 18" />
            </template>
            <template v-else>
              <path d="M4 7 H20" />
              <path d="M4 12 H20" />
              <path d="M4 17 H20" />
            </template>
          </svg>
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <nav
        v-if="mobileOpen"
        class="border-t border-mist-400/10 bg-night-950/95 backdrop-blur-xl md:hidden"
      >
        <div class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          <RouterLink
            v-for="item in navs"
            :key="item.name"
            :to="item.to"
            class="nav-link"
            :class="{ 'nav-link-active': route.name === item.name }"
            @click="mobileOpen = false"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
/* 日/夜图标：外层整体旋转 90°，内部两个图标交叉淡入淡出 */
.theme-icon {
  position: relative;
  display: block;
  height: 17px;
  width: 17px;
  transition: transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.theme-icon.is-light {
  transform: rotate(90deg);
}

.theme-icon svg {
  position: absolute;
  inset: 0;
  transition:
    opacity 0.28s ease,
    transform 0.5s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.theme-icon-moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.theme-icon-sun {
  opacity: 0;
  transform: rotate(-90deg) scale(0.4);
}

.theme-icon.is-light .theme-icon-moon {
  opacity: 0;
  transform: rotate(-90deg) scale(0.4);
}

.theme-icon.is-light .theme-icon-sun {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .theme-icon,
  .theme-icon svg {
    transition: opacity 0.2s ease;
    transform: none !important;
  }
}
</style>
