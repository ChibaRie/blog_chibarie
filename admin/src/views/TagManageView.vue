<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createTag, deleteTag, fetchTags, updateTag, type Tag } from '@/api'

const list = ref<Tag[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()

const form = reactive({
  name: '',
  slug: '',
})

const rules = {
  name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchTags()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', slug: '' })
  dialogVisible.value = true
}

function openEdit(row: Tag) {
  editingId.value = row.id
  Object.assign(form, { name: row.name, slug: row.slug })
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
    }
    if (editingId.value) {
      await updateTag(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createTag(payload)
      ElMessage.success('已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: Tag) {
  try {
    await ElMessageBox.confirm(
      `确定删除标签「${row.name}」吗？关联会一并解除。`,
      '删除标签',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteTag(row.id)
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
        共 {{ list.length }} 个标签
      </span>
      <el-button type="primary" :icon="Plus" @click="openCreate">
        新建标签
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="slug" label="Slug" min-width="140" />
      <el-table-column prop="postCount" label="文章数" width="90" />
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
      <template #empty>还没有标签</template>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑标签' : '新建标签'"
      width="420px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="24" placeholder="如：Go" />
        </el-form-item>
        <el-form-item label="Slug（留空自动生成）">
          <el-input v-model="form.slug" placeholder="url 路径，如 go" />
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
