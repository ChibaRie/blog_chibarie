<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Edit, Plus, View } from '@element-plus/icons-vue'
import { fetchAdminPosts, fetchSiteInfo, type Post, type SiteInfo } from '@/api'
import { formatDate, formatNumber } from '@/utils/format'

const router = useRouter()

const info = ref<SiteInfo | null>(null)
const recent = ref<Post[]>([])
const loading = ref(true)

const cards = computed(() => {
  const stats = info.value?.stats
  return [
    { label: '已发布文章', value: formatNumber(stats?.postCount), key: 'posts' },
    { label: '总字数', value: formatNumber(stats?.wordCount), key: 'words' },
    { label: '累计浏览', value: formatNumber(stats?.views), key: 'views' },
    { label: '待审评论', value: formatNumber(stats?.commentCount), key: 'comments' },
  ]
})

async function load() {
  loading.value = true
  try {
    const [infoData, postsData] = await Promise.all([
      fetchSiteInfo(),
      fetchAdminPosts({ page: 1, pageSize: 6 }),
    ])
    info.value = infoData
    recent.value = postsData.list
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div v-loading="loading">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <el-card
        v-for="card in cards"
        :key="card.key"
        shadow="never"
        class="page-card"
      >
        <div class="text-xs text-[var(--el-text-color-secondary)]">
          {{ card.label }}
        </div>
        <div class="mt-2 text-2xl font-medium">{{ card.value }}</div>
      </el-card>
    </div>

    <el-card shadow="never" class="page-card mt-5">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">最近文章</span>
          <el-button
            type="primary"
            size="small"
            :icon="Plus"
            @click="router.push({ name: 'post-new' })"
          >
            写文章
          </el-button>
        </div>
      </template>

      <el-table :data="recent" size="large">
        <el-table-column prop="title" label="标题" min-width="220">
          <template #default="{ row }">
            <el-link
              type="primary"
              :underline="false"
              @click="router.push({ name: 'post-edit', params: { id: row.id } })"
            >
              {{ row.title }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="120">
          <template #default="{ row }">
            {{ row.category?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="浏览" width="90">
          <template #default="{ row }">
            <span class="inline-flex items-center gap-1">
              <el-icon><View /></el-icon>
              {{ formatNumber(row.views) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="" width="60" align="right">
          <template #default="{ row }">
            <el-button
              text
              size="small"
              :icon="Edit"
              @click="router.push({ name: 'post-edit', params: { id: row.id } })"
            />
          </template>
        </el-table-column>
        <template #empty>还没有文章，点右上角「写文章」开始</template>
      </el-table>
    </el-card>
  </div>
</template>
