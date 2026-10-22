<script setup lang="ts">
/**
 * 说说管理：顶部一个快速发布框，下面一条条列出来。
 *
 * 这个页面的核心诉求是「随手发一条」——所以发布框常驻在顶部不需要点开弹窗，
 * 写完直接 Ctrl/Cmd + Enter 或点按钮就发出去，不强制走完整的编辑流程。
 * 需要改时间、改状态或改图片顺序时，再进编辑弹窗。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Picture, Plus, Upload } from '@element-plus/icons-vue'
import {
  createNote,
  deleteNote,
  fetchAdminNotes,
  updateNote,
  uploadImage,
  type Note,
} from '@/api'
import { formatDate, toDate, toRfc3339 } from '@/utils/format'

const PAGE_SIZE = 20
const MAX_LENGTH = 2000

const list = ref<Note[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)

// ===== 快速发布 =====
const draft = reactive({ content: '', images: [] as string[] })
const publishing = ref(false)
const quickUploading = ref(false)

// ===== 编辑弹窗 =====
const dialogVisible = ref(false)
const saving = ref(false)
const dialogUploading = ref(false)
const editing = ref<Note | null>(null)
const editForm = reactive({
  content: '',
  images: [] as string[],
  status: 'published' as 'draft' | 'published',
  publishedAt: null as Date | null,
})

const remaining = computed(() => MAX_LENGTH - draft.content.length)
const canPublish = computed(
  () => draft.content.trim().length > 0 && remaining.value >= 0 && !publishing.value,
)

async function load(targetPage = page.value) {
  loading.value = true
  try {
    const res = await fetchAdminNotes({ page: targetPage, pageSize: PAGE_SIZE })
    list.value = res.list
    total.value = res.total
    page.value = res.page
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

/** 上传一张图，返回它的 URL；失败时返回 null 由调用方决定是否中断 */
async function uploadOne(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning(`「${file.name}」不是图片，已跳过`)
    return null
  }
  try {
    const res = await uploadImage(file)
    return res.url
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : `${file.name} 上传失败`)
    return null
  }
}

async function handleQuickUpload(files: File[]) {
  quickUploading.value = true
  try {
    for (const file of files) {
      const url = await uploadOne(file)
      if (url) draft.images.push(url)
    }
  } finally {
    quickUploading.value = false
  }
}

async function handleDialogUpload(files: File[]) {
  dialogUploading.value = true
  try {
    for (const file of files) {
      const url = await uploadOne(file)
      if (url) editForm.images.push(url)
    }
  } finally {
    dialogUploading.value = false
  }
}

function removeImage(images: string[], index: number) {
  images.splice(index, 1)
}

/** 把某张图往前/往后挪一位，顺手支持调序（说说多图时有用） */
function moveImage(images: string[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= images.length) return
  const [item] = images.splice(index, 1)
  images.splice(target, 0, item)
}

async function handlePublish() {
  if (!draft.content.trim()) {
    ElMessage.warning('说说内容不能为空')
    return
  }
  if (draft.content.length > MAX_LENGTH) {
    ElMessage.warning(`说说不能超过 ${MAX_LENGTH} 字`)
    return
  }

  publishing.value = true
  try {
    await createNote({
      content: draft.content.trim(),
      images: [...draft.images],
      status: 'published',
    })
    ElMessage.success('已发布')
    draft.content = ''
    draft.images = []
    await load(1)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '发布失败')
  } finally {
    publishing.value = false
  }
}

function openEdit(row: Note) {
  editing.value = row
  editForm.content = row.content
  editForm.images = [...row.images]
  editForm.status = row.status
  editForm.publishedAt = toDate(row.publishedAt || row.createdAt)
  dialogVisible.value = true
}

async function handleSave() {
  if (!editing.value) return
  if (!editForm.content.trim()) {
    ElMessage.warning('说说内容不能为空')
    return
  }

  saving.value = true
  try {
    await updateNote(editing.value.id, {
      content: editForm.content.trim(),
      images: [...editForm.images],
      status: editForm.status,
      // 转成带本地时区偏移的 RFC3339 —— 直接传 Date 会被序列化成 UTC 的 Z 结尾，
      // 后端存下来就成了 UTC 时间，前台显示会差 8 小时甚至串到第二天
      publishedAt: toRfc3339(editForm.publishedAt),
    })
    ElMessage.success('已保存')
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: Note) {
  const preview = row.content.length > 30 ? `${row.content.slice(0, 30)}…` : row.content
  try {
    await ElMessageBox.confirm(
      `确定删除这条说说吗？\n\n「${preview}」\n\n它下面的评论也会一并删除。`,
      '删除说说',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteNote(row.id)
    ElMessage.success('已删除')
    // 从编辑弹窗里删的，顺手把弹窗关掉，否则会停在一个已经不存在的记录上
    if (editing.value?.id === row.id) {
      dialogVisible.value = false
      editing.value = null
    }
    // 删掉当前页最后一条时往前翻一页，避免停在空页上
    const nextPage = list.value.length === 1 && page.value > 1 ? page.value - 1 : page.value
    await load(nextPage)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

onMounted(() => void load(1))
</script>

<template>
  <div class="space-y-4">
    <!-- 快速发布 -->
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">发一条说说</span>
          <span
            class="text-xs"
            :class="remaining < 0 ? 'text-[var(--el-color-danger)]' : 'text-[var(--el-text-color-secondary)]'"
          >
            还有 {{ remaining }} 字
          </span>
        </div>
      </template>

      <el-input
        v-model="draft.content"
        type="textarea"
        :rows="4"
        resize="vertical"
        maxlength
        placeholder="随便写点什么…（Ctrl / Cmd + Enter 直接发布）"
        @keydown.ctrl.enter="handlePublish"
        @keydown.meta.enter="handlePublish"
      />

      <div v-if="draft.images.length" class="mt-3 flex flex-wrap gap-2">
        <div
          v-for="(img, index) in draft.images"
          :key="img"
          class="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--el-border-color-lighter)]"
        >
          <img :src="img" alt="" class="h-full w-full object-cover" />
          <button
            type="button"
            class="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/65 text-xs text-white group-hover:flex"
            aria-label="移除这张图"
            @click="removeImage(draft.images, index)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <el-upload
          :show-file-list="false"
          :auto-upload="false"
          multiple
          accept="image/*"
          :on-change="(file: any) => handleQuickUpload([file.raw])"
        >
          <el-button :icon="Picture" :loading="quickUploading">添加图片</el-button>
        </el-upload>

        <el-button
          type="primary"
          :icon="Upload"
          :loading="publishing"
          :disabled="!canPublish"
          @click="handlePublish"
        >
          发布
        </el-button>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never" class="page-card">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-sm text-[var(--el-text-color-secondary)]">
          共 {{ total }} 条说说 · 已发布的才会出现在前台「说说」页
        </span>
        <el-button text :icon="Plus" @click="load(page)">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column label="内容" min-width="320">
          <template #default="{ row }">
            <div class="py-1">
              <p class="whitespace-pre-wrap break-words text-sm">
                {{ row.content.length > 120 ? `${row.content.slice(0, 120)}…` : row.content }}
              </p>
              <div v-if="row.images.length" class="mt-2 flex flex-wrap gap-1.5">
                <img
                  v-for="img in row.images"
                  :key="img"
                  :src="img"
                  alt=""
                  class="h-10 w-10 rounded object-cover"
                />
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'published' ? 'success' : 'info'"
              size="small"
              disable-transitions
            >
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="互动" width="120">
          <template #default="{ row }">
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              {{ row.likes }} 赞 · {{ row.commentCount }} 评论
            </span>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="150">
          <template #default="{ row }">
            {{ formatDate(row.publishedAt || row.createdAt, true) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button text type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>还没有说说，在上面写第一条吧</template>
      </el-table>

      <div v-if="total > PAGE_SIZE" class="mt-4 flex justify-center">
        <el-pagination
          layout="prev, pager, next"
          :current-page="page"
          :page-size="PAGE_SIZE"
          :total="total"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 编辑 -->
    <el-dialog v-model="dialogVisible" title="编辑说说" width="560px">
      <el-form label-position="top">
        <el-form-item label="内容">
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="6"
            resize="vertical"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="图片">
          <div class="w-full">
            <div v-if="editForm.images.length" class="mb-2 flex flex-wrap gap-2">
              <div
                v-for="(img, index) in editForm.images"
                :key="img"
                class="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--el-border-color-lighter)]"
              >
                <img :src="img" alt="" class="h-full w-full object-cover" />
                <div
                  class="absolute inset-x-0 bottom-0 hidden justify-between bg-black/60 px-1 group-hover:flex"
                >
                  <button
                    type="button"
                    class="text-xs text-white disabled:opacity-30"
                    :disabled="index === 0"
                    aria-label="前移"
                    @click="moveImage(editForm.images, index, -1)"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    class="text-xs text-white disabled:opacity-30"
                    :disabled="index === editForm.images.length - 1"
                    aria-label="后移"
                    @click="moveImage(editForm.images, index, 1)"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  class="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/65 text-xs text-white group-hover:flex"
                  aria-label="移除这张图"
                  @click="removeImage(editForm.images, index)"
                >
                  ×
                </button>
              </div>
            </div>
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              multiple
              accept="image/*"
              :on-change="(file: any) => handleDialogUpload([file.raw])"
            >
              <el-button :icon="Picture" :loading="dialogUploading">添加图片</el-button>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio-button value="published">已发布</el-radio-button>
            <el-radio-button value="draft">草稿</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="发布时间">
          <el-date-picker
            v-model="editForm.publishedAt"
            type="datetime"
            placeholder="选择发布时间"
            :clearable="false"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button :icon="Delete" text type="danger" @click="editing && handleDelete(editing)">
          删除
        </el-button>
        <div class="flex-1" />
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
