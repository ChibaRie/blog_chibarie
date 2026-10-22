<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Delete,
  Picture,
  Upload,
} from '@element-plus/icons-vue'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import {
  fetchAdminSettings,
  updateSettings,
  uploadImage,
  type SettingsPayload,
  type SiteSettingsData,
} from '@/api'

// 能直接赋 URL 的表单字段。'hero' 只是多图上传时的「忙碌标记」——
// 头图现在是数组（heroBackgrounds），上传走的是 handleHeroUpload，不经这个类型
type UploadTarget = 'avatar' | 'pageBackground'

const loading = ref(true)
const saving = ref(false)
const uploading = ref<UploadTarget | 'hero' | null>(null)

const defaults = ref<SiteSettingsData['defaults']>({
  name: '',
  description: '',
  keywords: '',
  icp: '',
})

const form = reactive<SettingsPayload>({
  name: '',
  description: '',
  keywords: '',
  icp: '',
  avatar: '',
  heroBackground: '',
  heroBackgrounds: [],
  pageBackground: '',
  aboutContent: '',
  bilibili: '',
  github: '',
  steam: '',
  location: '',
})

const PAGE_BG_HINT =
  '文章页与各列表页的氛围底图，会自动模糊并轻度压暗，宜选构图干净、明暗对比不强的图。'

const socialFields = [
  { key: 'bilibili' as const, label: 'B 站', placeholder: 'https://space.bilibili.com/…' },
  { key: 'github' as const, label: 'GitHub', placeholder: 'https://github.com/…' },
  { key: 'steam' as const, label: 'Steam', placeholder: 'https://steamcommunity.com/id/…' },
  { key: 'location' as const, label: '所在地', placeholder: '如：广东广州（只显示文字）' },
]

async function load() {
  loading.value = true
  try {
    const data = await fetchAdminSettings()
    const { socials, ...rest } = data.site
    Object.assign(form, rest, {
      bilibili: socials?.bilibili ?? '',
      github: socials?.github ?? '',
      steam: socials?.steam ?? '',
      location: socials?.location ?? '',
    })
    defaults.value = data.defaults
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载设置失败')
  } finally {
    loading.value = false
  }
}

async function handlePick(file: File, target: UploadTarget) {
  uploading.value = target
  try {
    const res = await uploadImage(file)
    form[target] = res.url
    ElMessage.success('上传成功，点「保存设置」后生效')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    uploading.value = null
  }
}

function beforeUpload(file: File, target: 'avatar' | 'pageBackground') {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  void handlePick(file, target)
}

function clearField(field: 'avatar' | 'pageBackground') {
  form[field] = ''
}

// ===== 首页头图：多图管理 =====
async function handleHeroUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }

  uploading.value = 'hero'
  try {
    const res = await uploadImage(file)
    form.heroBackgrounds.push(res.url)
    ElMessage.success('已添加，点「保存设置」后生效')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    uploading.value = null
  }
}

function removeHeroImage(index: number) {
  form.heroBackgrounds.splice(index, 1)
}

function moveHeroImage(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.heroBackgrounds.length) return
  const list = form.heroBackgrounds
  const current = list[index]
  list[index] = list[target]
  list[target] = current
}

function restoreDefaults() {
  form.name = defaults.value.name
  form.description = defaults.value.description
  form.keywords = defaults.value.keywords
  form.icp = defaults.value.icp
  ElMessage.info('已填入配置文件的默认文案，保存后生效')
}

async function handleSave() {
  saving.value = true
  try {
    await updateSettings({ ...form })
    ElMessage.success('设置已保存，前台刷新即可看到')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => void load())
</script>

<template>
  <div v-loading="loading" class="max-w-[920px] pb-24">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <el-card shadow="never" class="page-card">
        <template #header>
          <span class="text-sm font-medium">博主头像</span>
        </template>

        <div class="flex items-center gap-5">
          <div
            class="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[var(--el-border-color)] bg-[var(--el-fill-color)]"
          >
            <img
              v-if="form.avatar"
              :src="form.avatar"
              alt="头像预览"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center text-xs text-[var(--el-text-color-placeholder)]"
            >
              未设置
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <el-upload
                :show-file-list="false"
                :auto-upload="false"
                accept="image/*"
                :on-change="(file: any) => beforeUpload(file.raw, 'avatar')"
              >
                <el-button
                  size="small"
                  :icon="Upload"
                  :loading="uploading === 'avatar'"
                >
                  上传图片
                </el-button>
              </el-upload>
              <el-button
                v-if="form.avatar"
                size="small"
                text
                type="danger"
                :icon="Delete"
                @click="clearField('avatar')"
              >
                清除
              </el-button>
            </div>
            <p class="text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
              建议正方形图片，前台会以圆形裁剪展示
            </p>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="page-card">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">首页头图</span>
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              {{ form.heroBackgrounds.length }} 张
            </span>
          </div>
        </template>

        <div class="space-y-3">
          <div v-if="form.heroBackgrounds.length" class="grid grid-cols-3 gap-2">
            <div
              v-for="(url, index) in form.heroBackgrounds"
              :key="`${index}-${url}`"
              class="group relative aspect-video overflow-hidden rounded-lg border border-[var(--el-border-color)]"
            >
              <img
                :src="url"
                :alt="`头图 ${index + 1}`"
                class="h-full w-full object-cover"
              />
              <span
                class="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white"
              >
                {{ index + 1 }}
              </span>
              <div
                class="absolute inset-0 hidden items-center justify-center gap-1 bg-black/55 group-hover:flex"
              >
                <el-button
                  size="small"
                  circle
                  :icon="ArrowLeft"
                  :disabled="index === 0"
                  title="前移"
                  @click="moveHeroImage(index, -1)"
                />
                <el-button
                  size="small"
                  circle
                  type="danger"
                  :icon="Delete"
                  title="删除"
                  @click="removeHeroImage(index)"
                />
                <el-button
                  size="small"
                  circle
                  :icon="ArrowRight"
                  :disabled="index === form.heroBackgrounds.length - 1"
                  title="后移"
                  @click="moveHeroImage(index, 1)"
                />
              </div>
            </div>
          </div>

          <div
            v-else
            class="flex h-20 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--el-border-color)] bg-[var(--el-fill-color)] text-xs text-[var(--el-text-color-placeholder)]"
          >
            <el-icon><Picture /></el-icon>
            还没有头图，未设置时使用默认插画
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="(file: any) => handleHeroUpload(file.raw)"
            >
              <el-button
                size="small"
                :icon="Upload"
                :loading="uploading === 'hero'"
              >
                添加图片
              </el-button>
            </el-upload>
            <span class="text-xs text-[var(--el-text-color-secondary)]">
              至少 2 张才会在前台轮播
            </span>
          </div>

          <p class="text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
            首页会整屏展示头图并按时轮播。建议 16:9 横图（如 2560×1440），
            尺寸不一时按居中裁剪填充；鼠标悬停缩略图可调序或删除。
          </p>
        </div>
      </el-card>
    </div>

    <el-card shadow="never" class="page-card mt-4">
      <template #header>
        <span class="text-sm font-medium">全站背景</span>
      </template>

      <div class="space-y-3">
        <div
          class="h-32 overflow-hidden rounded-lg border border-[var(--el-border-color)] bg-[var(--el-fill-color)]"
        >
          <img
            v-if="form.pageBackground"
            :src="form.pageBackground"
            alt="全站背景预览"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center gap-2 text-xs text-[var(--el-text-color-placeholder)]"
          >
            <el-icon><Picture /></el-icon>
            未设置，使用默认插画
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="(file: any) => beforeUpload(file.raw, 'pageBackground')"
          >
            <el-button
              size="small"
              :icon="Upload"
              :loading="uploading === 'pageBackground'"
            >
              上传图片
            </el-button>
          </el-upload>
          <el-button
            v-if="form.pageBackground"
            size="small"
            text
            type="danger"
            :icon="Delete"
            @click="clearField('pageBackground')"
          >
            恢复默认
          </el-button>
        </div>
        <p class="text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
          {{ PAGE_BG_HINT }}
        </p>
      </div>
    </el-card>

    <el-card shadow="never" class="page-card mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">站点信息</span>
          <el-button text size="small" type="primary" @click="restoreDefaults">
            恢复默认文案
          </el-button>
        </div>
      </template>

      <el-form label-position="top" class="max-w-[560px]">
        <el-form-item label="站点名称">
          <el-input v-model="form.name" maxlength="40" placeholder="如：chibarie" />
        </el-form-item>
        <el-form-item label="签名 / 副标题">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="120"
            show-word-limit
            placeholder="显示在首页站名下方与侧边栏头像卡"
          />
        </el-form-item>
        <el-form-item label="SEO 关键词">
          <el-input v-model="form.keywords" placeholder="逗号分隔，如：Go,Vue,博客" />
        </el-form-item>
        <el-form-item label="ICP 备案号（留空则不显示）">
          <el-input v-model="form.icp" placeholder="如：粤ICP备XXXXXXXX号" />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="page-card mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">社交链接</span>
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            留空则不显示该项
          </span>
        </div>
      </template>

      <div class="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        <div v-for="field in socialFields" :key="field.key" class="mb-3">
          <label
            class="mb-1.5 block text-xs text-[var(--el-text-color-regular)]"
            :for="`social-${field.key}`"
          >
            {{ field.label }}
          </label>
          <el-input
            :id="`social-${field.key}`"
            v-model="form[field.key]"
            :placeholder="field.placeholder"
            clearable
          />
        </div>
      </div>

      <p class="mt-1 text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
        前三项会以图标链接形式显示在首页侧边栏与「关于」页；所在地只展示文字，不生成链接。
      </p>
    </el-card>

    <el-card shadow="never" class="page-card mt-4">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">关于页内容</span>
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            支持 Markdown，前台渲染为正文
          </span>
        </div>
      </template>

      <MdEditor
        v-model="form.aboutContent"
        language="zh-CN"
        style="height: 420px"
      />

      <p class="mt-3 text-xs leading-relaxed text-[var(--el-text-color-placeholder)]">
        这段内容显示在「关于」页的<br />
        头像与统计信息下方。上方的头像、站名、签名来自本页其他设置，无需在此重复。
      </p>
    </el-card>

    <div
      class="sticky bottom-4 z-10 mt-5 flex items-center gap-3 rounded-xl border border-[var(--el-border-color)] bg-[var(--el-bg-color)] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
    >
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ saving ? '保存中…' : '保存设置' }}
      </el-button>
      <span class="text-xs text-[var(--el-text-color-secondary)]">
        改动会同步到前台，刷新页面即可看到
      </span>
    </div>
  </div>
</template>

<style scoped>
:deep(.page-card) {
  background: var(--el-bg-color-overlay);
}
</style>
