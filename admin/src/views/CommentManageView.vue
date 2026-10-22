<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteComment,
  fetchAdminComments,
  updateCommentStatus,
  type Comment,
  type CommentStatus,
  type CommentType,
} from '@/api'
import { formatDate } from '@/utils/format'

const router = useRouter()

const list = ref<Comment[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  page: 1,
  pageSize: 15,
  status: '' as CommentStatus | '',
  type: '' as CommentType | '',
})

const statusMeta: Record<
  string,
  { label: string; tag: 'warning' | 'success' | 'danger' | 'info' }
> = {
  pending: { label: '待审核', tag: 'warning' },
  approved: { label: '已通过', tag: 'success' },
  rejected: { label: '已驳回', tag: 'danger' },
}

async function load() {
  loading.value = true
  try {
    const res = await fetchAdminComments({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined,
      type: query.type || undefined,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function changeFilter() {
  query.page = 1
  void load()
}

async function setStatus(row: Comment, status: CommentStatus) {
  try {
    await updateCommentStatus(row.id, status)
    ElMessage.success(status === 'approved' ? '已通过' : '已驳回')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function handleDelete(row: Comment) {
  try {
    await ElMessageBox.confirm(
      '确定删除这条评论吗？其下回复会一并删除，操作不可恢复。',
      '删除评论',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteComment(row.id)
    ElMessage.success('已删除')
    if (list.value.length === 1 && query.page > 1) {
      query.page -= 1
    }
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

function goPost(row: Comment) {
  void router.push({ name: 'post-edit', params: { id: row.postId } })
}

onMounted(() => void load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <el-radio-group v-model="query.type" @change="changeFilter">
        <el-radio-button value="">全部来源</el-radio-button>
        <el-radio-button value="post">文章评论</el-radio-button>
        <el-radio-button value="note">说说评论</el-radio-button>
        <el-radio-button value="guestbook">留言板</el-radio-button>
      </el-radio-group>

      <el-radio-group v-model="query.status" @change="changeFilter">
        <el-radio-button value="">全部状态</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
      </el-radio-group>

      <div class="flex-1" />
      <span class="text-xs text-[var(--el-text-color-secondary)]">
        共 {{ total }} 条
      </span>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="评论内容" min-width="260">
        <template #default="{ row }">
          <div class="max-w-[420px]">
            <p class="!m-0 line-clamp-2 text-[13px] leading-relaxed">
              {{ row.content }}
            </p>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="nickname" label="昵称" width="110" />
      <el-table-column label="来源" min-width="160">
        <template #default="{ row }">
          <el-tag
            v-if="row.type === 'guestbook'"
            size="small"
            type="info"
            effect="plain"
          >
            留言板
          </el-tag>
          <el-tag
            v-else-if="row.type === 'note'"
            size="small"
            type="warning"
            effect="plain"
          >
            说说 · {{ row.postTitle || `#${row.postId}` }}
          </el-tag>
          <el-link
            v-else
            type="primary"
            :underline="false"
            @click="goPost(row)"
          >
            {{ row.postTitle || `#${row.postId}` }}
          </el-link>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            :type="statusMeta[row.status]?.tag || 'info'"
            size="small"
          >
            {{ statusMeta[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="110">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status !== 'approved'"
            text
            type="success"
            size="small"
            @click="setStatus(row, 'approved')"
          >
            通过
          </el-button>
          <el-button
            v-if="row.status !== 'rejected'"
            text
            type="warning"
            size="small"
            @click="setStatus(row, 'rejected')"
          >
            驳回
          </el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>没有符合条件的评论</template>
    </el-table>

    <div class="mt-4 flex justify-end">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>
  </el-card>
</template>
