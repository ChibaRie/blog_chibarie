<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { login, setToken } from '@/api'

const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
})
const loading = ref(false)
const formRef = ref()

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const result = await login(form.username.trim(), form.password)
    setToken(result.token)
    ElMessage.success(`欢迎回来，${result.user.nickname || result.user.username}`)

    const redirect = (route.query.redirect as string) || '/'
    void router.replace(redirect)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-[var(--el-bg-color-page)] px-4"
  >
    <div class="w-full max-w-[380px]">
      <div class="mb-8 text-center">
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          class="mx-auto"
        >
          <defs>
            <linearGradient id="loginLogo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f0c4de" />
              <stop offset="100%" stop-color="#8b8fd4" />
            </linearGradient>
          </defs>
          <path
            d="M12 1.8 L14.55 9.15 L22 12 L14.55 14.85 L12 22.2 L9.45 14.85 L2 12 L9.45 9.15 Z"
            fill="url(#loginLogo)"
          />
        </svg>
        <h1 class="mt-4 text-lg font-medium">chibarie 管理后台</h1>
        <p class="mt-1.5 text-xs text-[var(--el-text-color-secondary)]">
          只有你自己能看到这个页面
        </p>
      </div>

      <el-card shadow="never" class="page-card">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              placeholder="用户名"
              autofocus
            />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              show-password
              placeholder="密码"
            />
          </el-form-item>
          <el-button
            type="primary"
            class="!w-full"
            size="large"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中…' : '登录' }}
          </el-button>
        </el-form>
      </el-card>

      <p class="mt-5 text-center text-xs text-[var(--el-text-color-placeholder)]">
        默认账号 admin / admin123，登录后请尽快修改
      </p>
    </div>
  </div>
</template>
