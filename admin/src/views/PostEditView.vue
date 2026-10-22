<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { MdEditor } from 'md-editor-v3'
import type { ExposeParam } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import {
  createPost,
  fetchAdminPost,
  fetchCategories,
  fetchTags,
  updatePost,
  uploadImage,
  type Category,
  type PostPayload,
  type Tag,
} from '@/api'
import { toDate, toRfc3339 } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const editId = computed(() => {
  const raw = route.params.id
  return raw ? Number(raw) : null
})

const form = reactive<PostPayload>({
  title: '',
  slug: '',
  summary: '',
  content: '',
  cover: '',
  status: 'draft',
  categoryId: null,
  tagIds: [],
  isTop: false,
})

/**
 * 发布日期单独用一个 Date 持有，不塞进 form：
 * 选择器用的是 Date 对象，而提交给后端的是带时区偏移的字符串，
 * 两者在提交那一刻才转换，避免表单里出现两种格式。
 */
const publishDate = ref<Date | null>(null)

const dateShortcuts = [
  { text: '此刻', value: () => new Date() },
  { text: '今天 0 点', value: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { text: '昨天', value: () => new Date(Date.now() - 86400000) },
  { text: '一周前', value: () => new Date(Date.now() - 7 * 86400000) },
]

// 发布时间可以往过去调（补历史文章），但没必要选到未来
function disableFutureDate(date: Date) {
  return date.getTime() > Date.now() + 86400000
}

const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const saving = ref(false)
const pageLoading = ref(false)
const formRef = ref()
const editorRef = ref<ExposeParam>()

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
}

async function loadPost(id: number) {
  pageLoading.value = true
  try {
    const post = await fetchAdminPost(id)
    form.title = post.title
    form.slug = post.slug
    form.summary = post.summary
    form.content = post.content
    form.cover = post.cover
    form.status = post.status
    form.categoryId = post.categoryId
    form.tagIds = (post.tags || []).map((tag) => tag.id)
    form.isTop = post.isTop
    publishDate.value = toDate(post.publishedAt)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载文章失败')
  } finally {
    pageLoading.value = false
  }
}

async function save(status: 'draft' | 'published') {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!form.content.trim()) {
    ElMessage.warning('正文不能为空')
    return
  }

  form.status = status
  saving.value = true

  // 发布日期转成带本地时区偏移的 RFC3339；未选则传 undefined，
  // 后端会保留原值（草稿则在真正发布时自动填当前时间）
  const payload: PostPayload = {
    ...form,
    publishedAt: toRfc3339(publishDate.value) ?? undefined,
  }

  try {
    if (editId.value) {
      await updatePost(editId.value, payload)
      ElMessage.success(status === 'published' ? '已更新并发布' : '草稿已保存')
    } else {
      const created = await createPost(payload)
      ElMessage.success(status === 'published' ? '发布成功' : '草稿已保存')
      await router.replace({ name: 'post-edit', params: { id: created.id } })
    }
    void router.push({ name: 'posts' })
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleUploadImg(
  files: File[],
  callback: (urls: string[]) => void,
) {
  const urls: string[] = []
  for (const file of files) {
    try {
      const res = await uploadImage(file)
      urls.push(res.url)
    } catch (err) {
      ElMessage.error(
        err instanceof Error ? err.message : `上传失败：${file.name}`,
      )
    }
  }
  callback(urls)
}

// ===== 封面图 =====
const coverUploading = ref(false)
const coverPickerVisible = ref(false)

async function handleCoverPick(file: File) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }

  coverUploading.value = true
  try {
    const res = await uploadImage(file)
    form.cover = res.url
    ElMessage.success('封面已更新，保存文章后生效')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '封面上传失败')
  } finally {
    coverUploading.value = false
  }
}

// 正文里已经插入的图片，可直接选作封面
const contentImages = computed(() => {
  const urls = new Set<string>()
  const patterns = [
    /!\[[^\]]*\]\(([^)\s]+)\)/g,
    /<img[^>]+src=["']([^"']+)["']/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(form.content)) !== null) {
      const url = match[1]
      if (url && !url.startsWith('data:')) urls.add(url)
    }
  }

  return [...urls].reverse()
})

function pickContentImage(url: string) {
  form.cover = url
  coverPickerVisible.value = false
  ElMessage.success('已设为封面，保存文章后生效')
}

onMounted(async () => {
  try {
    const [cats, tgs] = await Promise.all([fetchCategories(), fetchTags()])
    categories.value = cats
    tags.value = tgs
  } catch {
    ElMessage.warning('分类或标签加载失败，仍可正常写作')
  }

  if (editId.value) {
    await loadPost(editId.value)
  }
})
</script>

<template>
  <div v-loading="pageLoading">
    <el-card shadow="never" class="page-card">
      <div class="flex items-center gap-3">
        <el-button text :icon="ArrowLeft" @click="router.push({ name: 'posts' })" />
        <span class="text-sm font-medium">
          {{ editId ? '编辑文章' : '新建文章' }}
        </span>
        <span v-if="editId" class="text-xs text-[var(--el-text-color-placeholder)]">
          #{{ editId }}
        </span>
        <div class="flex-1" />
        <el-button :disabled="saving" @click="save('draft')">存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="save('published')">
          {{ saving ? '保存中…' : '发布' }}
        </el-button>
      </div>
    </el-card>

    <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div class="min-w-0 space-y-4">
        <el-card shadow="never" class="page-card">
          <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
            <el-form-item prop="title" class="!mb-0">
              <el-input
                v-model="form.title"
                placeholder="文章标题"
                size="large"
                maxlength="120"
                show-word-limit
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card
          shadow="never"
          class="page-card overflow-hidden !px-0 [&_.el-card__body]:!p-0"
        >
          <MdEditor
            ref="editorRef"
            v-model="form.content"
            theme="dark"
            class="!bg-transparent"
            :style="{ height: '620px' }"
            placeholder="从这里开始写…（Markdown 语法，图片可直接粘贴上传）"
            :footers="['markdownTotal', '=', 'scrollSwitch']"
            @on-upload-img="handleUploadImg"
          />
        </el-card>
      </div>

      <div class="space-y-4">
        <el-card shadow="never" class="page-card">
          <template #header>
            <span class="text-sm font-medium">发布设置</span>
          </template>
          <el-form label-position="top" size="default">
            <el-form-item label="分类">
              <el-select
                v-model="form.categoryId"
                placeholder="选择分类"
                clearable
                class="w-full"
              >
                <el-option
                  v-for="item in categories"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="标签">
              <el-select
                v-model="form.tagIds"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或新建标签"
                class="w-full"
              >
                <el-option
                  v-for="tag in tags"
                  :key="tag.id"
                  :label="tag.name"
                  :value="tag.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="封面图">
              <div v-loading="coverUploading" class="w-full space-y-2">
                <el-upload
                  drag
                  class="cover-uploader"
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/*"
                  :on-change="(file: any) => handleCoverPick(file.raw)"
                >
                  <div v-if="!form.cover" class="cover-drop">
                    <el-icon class="text-lg opacity-60"><Plus /></el-icon>
                    <p class="mt-1.5 text-xs">点击或拖拽图片到此处</p>
                  </div>
                  <div v-else class="cover-preview">
                    <img :src="form.cover" alt="封面预览" />
                    <span class="cover-preview-mask">点击更换封面</span>
                  </div>
                </el-upload>

                <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <el-button
                    v-if="contentImages.length"
                    size="small"
                    text
                    type="primary"
                    @click="coverPickerVisible = true"
                  >
                    从正文选图（{{ contentImages.length }}）
                  </el-button>
                  <el-button
                    v-if="form.cover"
                    size="small"
                    text
                    type="danger"
                    @click="form.cover = ''"
                  >
                    移除封面
                  </el-button>
                </div>

                <el-input
                  v-model="form.cover"
                  size="small"
                  placeholder="也可以直接粘贴图片链接"
                  clearable
                />
              </div>
            </el-form-item>

            <el-form-item label="摘要（留空则自动截取）">
              <el-input
                v-model="form.summary"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="自定义 Slug（留空自动生成）">
              <el-input v-model="form.slug" placeholder="url 路径，如 my-post" clearable />
            </el-form-item>

            <el-form-item label="发布日期">
              <div class="w-full">
                <el-date-picker
                  v-model="publishDate"
                  type="datetime"
                  placeholder="留空则发布时自动填写"
                  format="YYYY-MM-DD HH:mm"
                  :shortcuts="dateShortcuts"
                  :disabled-date="disableFutureDate"
                  clearable
                  class="!w-full"
                />
                <p class="mt-1.5 text-xs leading-relaxed text-[var(--el-text-color-secondary)]">
                  用于前台展示与排序，可把导入的旧文章改成原始日期。
                  <span v-if="form.status === 'draft'" class="opacity-80">
                    当前是草稿，清空后会在真正发布时自动填当前时间。
                  </span>
                </p>
              </div>
            </el-form-item>

            <el-form-item label="置顶">
              <el-switch v-model="form.isTop" />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="page-card">
          <div class="text-xs leading-relaxed text-[var(--el-text-color-secondary)]">
            <p>· 编辑器里可直接粘贴或拖入图片，会自动上传到服务器</p>
            <p>· 封面图支持上传本地图片、拖拽上传，或直接从正文里已有图片中挑选</p>
            <p>· 「发布」后文章立即在前台可见，存草稿则只有后台可见</p>
            <p>· 摘要留空时会自动从正文提取纯文本前 120 字</p>
            <p>· 发布日期可改；清空则保留原值（草稿在发布时才填当前时间）</p>
          </div>
        </el-card>
      </div>
    </div>

    <el-dialog
      v-model="coverPickerVisible"
      title="从正文中选择封面"
      width="640px"
    >
      <div v-if="contentImages.length" class="grid grid-cols-3 gap-3">
        <button
          v-for="url in contentImages"
          :key="url"
          type="button"
          class="group overflow-hidden rounded-lg border border-[var(--el-border-color)] transition hover:border-[var(--el-color-primary)]"
          @click="pickContentImage(url)"
        >
          <img
            :src="url"
            alt=""
            class="aspect-video w-full object-cover transition group-hover:opacity-85"
          />
        </button>
      </div>
      <p v-else class="text-sm text-[var(--el-text-color-secondary)]">
        正文里还没有图片，可以先在编辑器里上传。
      </p>
    </el-dialog>
  </div>
</template>

<style scoped>
.cover-uploader :deep(.el-upload) {
  display: block;
  width: 100%;
}

.cover-uploader :deep(.el-upload-dragger) {
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  border-color: var(--el-border-color);
  transition: border-color 0.2s ease;
}

.cover-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary);
}

.cover-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  color: var(--el-text-color-placeholder);
}

.cover-preview {
  position: relative;
  display: block;
  aspect-ratio: 16 / 10;
}

.cover-preview img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.cover-preview-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.52);
  color: #fff;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cover-preview:hover .cover-preview-mask {
  opacity: 1;
}
</style>
