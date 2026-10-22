<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  deletePost,
  fetchAdminPost,
  fetchAdminPosts,
  fetchCategories,
  updatePost,
  type Category,
  type Post,
} from '@/api'
import { formatNumber, toDate, toRfc3339 } from '@/utils/format'

const router = useRouter()

const posts = ref<Post[]>([])
const categories = ref<Category[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  categoryId: undefined as number | undefined,
})

async function load() {
  loading.value = true
  try {
    const res = await fetchAdminPosts({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      categoryId: query.categoryId,
    })
    posts.value = res.list
    total.value = res.total
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  void load()
}

async function handleDelete(post: Post) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${post.title}」吗？关联的评论会一并删除，操作不可恢复。`,
      '删除文章',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deletePost(post.id)
    ElMessage.success('已删除')
    if (posts.value.length === 1 && query.page > 1) {
      query.page -= 1
    }
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

// ===== 列表内快捷改发布日期 =====

const savingDateId = ref<number | null>(null)

/** 只换年月日，保留原来的时分秒 —— 补历史日期时不该把时间重置成 00:00 */
function mergeDateKeepTime(original: string | null, picked: Date): string | null {
  const base = toDate(original) ?? new Date()
  const merged = new Date(picked)
  merged.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0)
  return toRfc3339(merged)
}

async function changeDate(post: Post, picked: Date | string | null) {
  if (!(picked instanceof Date) || Number.isNaN(picked.getTime())) return

  savingDateId.value = post.id
  try {
    // 后端的更新接口是「全量覆盖」，所以必须先取回完整文章再合并，
    // 直接把列表行（不含正文、标签）PUT 上去会把正文和标签清空。
    const full = await fetchAdminPost(post.id)
    await updatePost(post.id, {
      title: full.title,
      slug: full.slug,
      summary: full.summary,
      content: full.content,
      cover: full.cover,
      status: full.status,
      categoryId: full.categoryId,
      tagIds: (full.tags ?? []).map((tag) => tag.id),
      isTop: full.isTop,
      publishedAt: mergeDateKeepTime(full.publishedAt, picked) ?? undefined,
    })
    ElMessage.success('发布日期已更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '修改日期失败')
  } finally {
    savingDateId.value = null
    await load()
  }
}

onMounted(async () => {
  void load()
  try {
    categories.value = await fetchCategories()
  } catch {
    // 分类加载失败不阻塞列表
  }
})
</script>

<template>
  <el-card shadow="never" class="page-card">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <el-input
        v-model="query.keyword"
        placeholder="搜标题 / 摘要 / 正文"
        clearable
        class="!w-56"
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-select
        v-model="query.categoryId"
        placeholder="全部分类"
        clearable
        class="!w-40"
        @change="search"
      >
        <el-option
          v-for="item in categories"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-button :icon="Search" @click="search">查询</el-button>

      <div class="flex-1" />
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push({ name: 'post-new' })"
      >
        写文章
      </el-button>
    </div>

    <el-table v-loading="loading" :data="posts">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="标题" min-width="240">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <el-tag v-if="row.isTop" size="small" effect="plain">置顶</el-tag>
            <el-link
              type="primary"
              :underline="false"
              @click="router.push({ name: 'post-edit', params: { id: row.id } })"
            >
              {{ row.title }}
            </el-link>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="110">
        <template #default="{ row }">
          {{ row.category?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'published' ? 'success' : 'info'"
            size="small"
          >
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="字数" width="80">
        <template #default="{ row }">
          {{ formatNumber(row.wordCount) }}
        </template>
      </el-table-column>
      <el-table-column label="浏览" width="80">
        <template #default="{ row }">
          {{ formatNumber(row.views) }}
        </template>
      </el-table-column>
      <el-table-column label="评论" width="80" prop="commentCount" />
      <el-table-column label="发布时间" width="132">
        <template #default="{ row }">
          <!-- 点日期直接改；改完自动保存（保留原来的时分秒） -->
          <el-date-picker
            :model-value="toDate(row.publishedAt || row.createdAt)"
            type="date"
            size="small"
            format="YYYY-MM-DD"
            :clearable="false"
            :disabled="savingDateId === row.id"
            class="date-cell-picker"
            @update:model-value="(v: Date | string | null) => changeDate(row, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button
            text
            type="primary"
            size="small"
            @click="router.push({ name: 'post-edit', params: { id: row.id } })"
          >
            编辑
          </el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>没有匹配的文章</template>
    </el-table>

    <div class="mt-4 flex justify-end">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
      />
    </div>
  </el-card>
</template>

<!--
  这里刻意不加 scoped：
  el-table-column 的插槽内容是由 TableColumn 组件自己渲染的，不会带上本组件的
  scope 属性（实测该元素上没有任何 data-v-*），所以 scoped + :deep() 永远选不中它。
  改用唯一类名 .date-cell-picker 限定作用范围，避免影响其他页面。
-->
<style>
/* 日期单元格做成「平时像纯文本、悬停才像输入框」，
   否则每行都顶着一个边框完整的输入框，表格会很吵 */
.date-cell-picker .el-input__wrapper {
  box-shadow: none;
  background-color: transparent;
  padding-left: 0;
  padding-right: 0;
}

.date-cell-picker .el-input__inner {
  cursor: pointer;
}

.date-cell-picker .el-input__wrapper:hover {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  border-radius: 4px;
  padding-left: 6px;
  background-color: var(--el-fill-color-light);
}

.date-cell-picker .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  border-radius: 4px;
  padding-left: 6px;
}
</style>
