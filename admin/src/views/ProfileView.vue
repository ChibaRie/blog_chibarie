<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { changePassword, fetchProfile, type User } from '@/api'
import { formatDate } from '@/utils/format'

const router = useRouter()

const user = ref<User | null>(null)
const loading = ref(true)
const saving = ref(false)
const formRef = ref()

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (err?: Error) => void) => {
        if (value !== form.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function load() {
  loading.value = true
  try {
    user.value = await fetchProfile()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleChange() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await changePassword(form.oldPassword, form.newPassword)
    ElMessage.success('密码已修改，下次请用新密码登录')
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '修改失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div v-loading="loading" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <el-card shadow="never" class="page-card">
      <template #header>
        <span class="text-sm font-medium">账号信息</span>
      </template>

      <div v-if="user" class="space-y-3 text-sm">
        <div class="flex items-center gap-4">
          <el-avatar :size="56" class="!bg-[var(--el-color-primary-light-8)] !text-lg">
            {{ (user.nickname || user.username).slice(0, 1).toUpperCase() }}
          </el-avatar>
          <div>
            <div class="text-base font-medium">
              {{ user.nickname || user.username }}
            </div>
            <div class="mt-0.5 text-xs text-[var(--el-text-color-secondary)]">
              @{{ user.username }}
            </div>
          </div>
        </div>

        <el-divider class="!my-4" />

        <div class="flex justify-between">
          <span class="text-[var(--el-text-color-secondary)]">角色</span>
          <el-tag size="small" :type="user.role === 'admin' ? 'danger' : 'info'">
            {{ user.role === 'admin' ? '管理员' : user.role }}
          </el-tag>
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--el-text-color-secondary)]">邮箱</span>
          <span>{{ user.email || '未设置' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[var(--el-text-color-secondary)]">签名</span>
          <span>{{ user.bio || '未设置' }}</span>
        </div>
        <div v-if="user.createdAt" class="flex justify-between">
          <span class="text-[var(--el-text-color-secondary)]">注册时间</span>
          <span>{{ formatDate(user.createdAt) }}</span>
        </div>

        <el-divider class="!my-4" />
        <p class="text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
          昵称、邮箱等资料暂时只能通过数据库或接口修改，后续版本会在后台提供编辑。
        </p>
      </div>
    </el-card>

    <el-card shadow="never" class="page-card">
      <template #header>
        <span class="text-sm font-medium">修改密码</span>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="max-w-[360px]"
        @keyup.enter="handleChange"
      >
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            placeholder="当前使用的密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="再输入一次"
          />
        </el-form-item>
        <el-button type="primary" :loading="saving" @click="handleChange">
          修改密码
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>
