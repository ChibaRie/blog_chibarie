<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload } from '@element-plus/icons-vue'
import {
  createLink,
  deleteLink,
  fetchLinks,
  updateLink,
  uploadImage,
  type FriendLink,
} from '@/api'

const list = ref<FriendLink[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const saving = ref(false)
const uploading = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()

const form = reactive({
  name: '',
  url: '',
  avatar: '',
  description: '',
  sort: undefined as number | undefined,
})

const rules = {
  name: [{ required: true, message: '请输入站点名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入站点链接', trigger: 'blur' },
    {
      pattern: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i,
      message: '链接格式不正确，如 example.com 或 https://example.com',
      trigger: 'blur',
    },
  ],
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchLinks()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', url: '', avatar: '', description: '', sort: undefined })
  dialogVisible.value = true
}

function openEdit(row: FriendLink) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    url: row.url,
    avatar: row.avatar,
    description: row.description,
    sort: row.sort,
  })
  dialogVisible.value = true
}

/** 头像可以直接传本地图片，上传后自动填入 URL */
async function handleAvatarUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  uploading.value = true
  try {
    const res = await uploadImage(file)
    form.avatar = res.url
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      avatar: form.avatar.trim(),
      description: form.description.trim(),
      sort: form.sort,
    }
    if (editingId.value) {
      await updateLink(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createLink(payload)
      ElMessage.success('已添加')
    }
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FriendLink) {
  try {
    await ElMessageBox.confirm(
      `确定删除友链「${row.name}」吗？`,
      '删除友链',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteLink(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

onMounted(() => void load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <div class="mb-4 flex items-center justify-between">
      <span class="text-sm text-[var(--el-text-color-secondary)]">
        共 {{ list.length }} 个友链 · 按排序值从小到大展示在前台「友链」页
      </span>
      <el-button type="primary" :icon="Plus" @click="openCreate">
        添加友链
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column label="站点" min-width="200">
        <template #default="{ row }">
          <div class="flex items-center gap-3">
            <img
              v-if="row.avatar"
              :src="row.avatar"
              alt=""
              class="h-9 w-9 rounded-full object-cover"
            />
            <span
              v-else
              class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--el-fill-color)] text-sm text-[var(--el-text-color-secondary)]"
            >
              {{ row.name.charAt(0).toUpperCase() }}
            </span>
            <div class="min-w-0">
              <div class="truncate text-sm">{{ row.name }}</div>
              <div class="truncate text-xs text-[var(--el-text-color-secondary)]">
                {{ row.url }}
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="描述" min-width="200">
        <template #default="{ row }">
          {{ row.description || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="70" />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" @click="openEdit(row)">
            编辑
          </el-button>
          <el-button text type="danger" size="small" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
      <template #empty>还没有友链，点右上角「添加友链」</template>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑友链' : '添加友链'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="站点名称" prop="name">
          <el-input v-model="form.name" maxlength="32" placeholder="如：某某的博客" />
        </el-form-item>
        <el-form-item label="站点链接" prop="url">
          <el-input v-model="form.url" placeholder="example.com（可省略 https://）" />
        </el-form-item>
        <el-form-item label="头像 URL（留空则用首字母占位）">
          <div class="flex w-full items-center gap-2">
            <el-input
              v-model="form.avatar"
              placeholder="https://… 或点击右侧上传"
              clearable
            />
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="(file: any) => handleAvatarUpload(file.raw)"
            >
              <el-button :icon="Upload" :loading="uploading">上传</el-button>
            </el-upload>
            <img
              v-if="form.avatar"
              :src="form.avatar"
              alt="头像预览"
              class="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="100"
            placeholder="一句话介绍这个站点"
          />
        </el-form-item>
        <el-form-item label="排序（小的在前，留空排到最后）">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>
