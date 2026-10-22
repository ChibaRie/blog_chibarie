<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from '@/api'

const list = ref<Category[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()

const form = reactive({
  name: '',
  slug: '',
  description: '',
  sort: 0,
})

const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchCategories()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', slug: '', description: '', sort: 0 })
  dialogVisible.value = true
}

function openEdit(row: Category) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    slug: row.slug,
    description: row.description,
    sort: row.sort,
  })
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
      description: form.description.trim(),
      sort: form.sort,
    }
    if (editingId.value) {
      await updateCategory(editingId.value, payload)
      ElMessage.success('已更新')
    } else {
      await createCategory(payload)
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

async function handleDelete(row: Category) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${row.name}」吗？该分类下共 ${row.postCount} 篇文章，删除后文章会变成未分类。`,
      '删除分类',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteCategory(row.id)
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
        共 {{ list.length }} 个分类
      </span>
      <el-button type="primary" :icon="Plus" @click="openCreate">
        新建分类
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" min-width="120" />
      <el-table-column prop="slug" label="Slug" min-width="120" />
      <el-table-column prop="description" label="描述" min-width="180">
        <template #default="{ row }">
          {{ row.description || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="70" />
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
      <template #empty>还没有分类</template>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '新建分类'"
      width="460px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="32" placeholder="如：技术笔记" />
        </el-form-item>
        <el-form-item label="Slug（留空自动生成）">
          <el-input v-model="form.slug" placeholder="url 路径，如 tech" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="100"
          />
        </el-form-item>
        <el-form-item label="排序（小的在前）">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
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
