<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  ChatLineSquare,
  Collection,
  Document,
  Fold,
  Expand,
  Link as LinkIcon,
  Odometer,
  PriceTag,
  Setting,
  SwitchButton,
  User as UserIcon,
} from '@element-plus/icons-vue'
import { clearToken, getToken } from '@/api/client'
import { fetchProfile, type User } from '@/api'

const route = useRoute()
const router = useRouter()

const collapsed = ref(false)
const user = ref<User | null>(null)

const menus = [
  { name: 'dashboard', title: '概览', icon: Odometer },
  { name: 'posts', title: '文章管理', icon: Document },
  { name: 'notes', title: '说说管理', icon: ChatLineSquare },
  { name: 'categories', title: '分类管理', icon: Collection },
  { name: 'tags', title: '标签管理', icon: PriceTag },
  { name: 'links', title: '友链管理', icon: LinkIcon },
  { name: 'comments', title: '评论管理', icon: ChatDotRound },
  { name: 'settings', title: '站点设置', icon: Setting },
]

const activeMenu = computed(() => {
  if (route.name === 'post-new' || route.name === 'post-edit') return 'posts'
  return String(route.name || 'dashboard')
})

const pageTitle = computed(
  () => (route.meta?.title as string) || '管理后台',
)

const displayName = computed(
  () => user.value?.nickname || user.value?.username || '管理员',
)

async function loadProfile() {
  if (!getToken()) return
  try {
    user.value = await fetchProfile()
  } catch {
    // 401 已由拦截器处理
  }
}

function handleUserCommand(command: string | number | object) {
  if (command === 'profile') {
    void router.push({ name: 'profile' })
    return
  }
  if (command === 'logout') {
    clearToken()
    ElMessage.success('已退出登录')
    void router.push({ name: 'login' })
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <el-container class="h-screen">
    <el-aside
      :width="collapsed ? '64px' : '208px'"
      class="transition-[width] duration-200 border-r border-[var(--el-border-color-lighter)]"
    >
      <div
        class="flex h-14 items-center gap-2 overflow-hidden px-4"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" class="shrink-0">
          <defs>
            <linearGradient id="adminLogo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f0c4de" />
              <stop offset="100%" stop-color="#8b8fd4" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.8 L14.55 9.15 L22 12 L14.55 14.85 L12 22.2 L9.45 14.85 L2 12 L9.45 9.15 Z"
            fill="url(#adminLogo)"
          />
        </svg>
        <span
          v-if="!collapsed"
          class="whitespace-nowrap text-sm font-medium text-[var(--el-text-color-primary)]"
        >
          chibarie 后台
        </span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="!border-r-0"
      >
        <el-menu-item
          v-for="menu in menus"
          :key="menu.name"
          :index="menu.name"
          :route="{ name: menu.name }"
        >
          <el-icon><component :is="menu.icon" /></el-icon>
          <template #title>{{ menu.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header
        class="flex h-14 items-center justify-between border-b border-[var(--el-border-color-lighter)]"
      >
        <div class="flex items-center gap-3">
          <el-button
            text
            :icon="collapsed ? Expand : Fold"
            @click="collapsed = !collapsed"
          />
          <span class="text-sm font-medium">{{ pageTitle }}</span>
        </div>

        <el-dropdown trigger="click" @command="handleUserCommand">
          <span
            class="flex cursor-pointer items-center gap-2 text-sm text-[var(--el-text-color-regular)]"
          >
            <el-avatar :size="28" class="!bg-[var(--el-color-primary-light-8)]">
              {{ displayName.slice(0, 1).toUpperCase() }}
            </el-avatar>
            {{ displayName }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile" :icon="UserIcon">
                账号设置
              </el-dropdown-item>
              <el-dropdown-item command="logout" :icon="SwitchButton" divided>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="!p-5">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>
