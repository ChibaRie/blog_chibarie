import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/api/client'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '概览' },
        },
        {
          path: 'posts',
          name: 'posts',
          component: () => import('@/views/PostListView.vue'),
          meta: { title: '文章管理' },
        },
        {
          path: 'posts/new',
          name: 'post-new',
          component: () => import('@/views/PostEditView.vue'),
          meta: { title: '新建文章' },
        },
        {
          path: 'posts/:id/edit',
          name: 'post-edit',
          component: () => import('@/views/PostEditView.vue'),
          meta: { title: '编辑文章' },
        },
        {
          path: 'notes',
          name: 'notes',
          component: () => import('@/views/NoteManageView.vue'),
          meta: { title: '说说管理' },
        },
        {
          path: 'categories',
          name: 'categories',
          component: () => import('@/views/CategoryManageView.vue'),
          meta: { title: '分类管理' },
        },
        {
          path: 'tags',
          name: 'tags',
          component: () => import('@/views/TagManageView.vue'),
          meta: { title: '标签管理' },
        },
        {
          path: 'comments',
          name: 'comments',
          component: () => import('@/views/CommentManageView.vue'),
          meta: { title: '评论管理' },
        },
        {
          path: 'links',
          name: 'links',
          component: () => import('@/views/LinkManageView.vue'),
          meta: { title: '友链管理' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: '站点设置' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: '账号设置' },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (!getToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  const base = 'chibarie 管理后台'
  const title = to.meta?.title as string | undefined
  document.title = title ? `${title} · ${base}` : base
})

export default router
