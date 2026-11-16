<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPosts, fetchTags, type Post, type Tag } from '@/api'
import RecordRow from '@/components/RecordRow.vue'

const route = useRoute()
const router = useRouter()

const tags = ref<Tag[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const error = ref('')

const sortedTags = computed(() =>
  [...tags.value].sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'zh-CN')),
)
const activeSlug = computed(() => String(route.query.slug || ''))
const activeTag = computed(() => tags.value.find((tag) => tag.slug === activeSlug.value) || null)
const visiblePosts = computed(() =>
  activeTag.value ? posts.value.filter((post) => post.tags.some((tag) => tag.id === activeTag.value?.id)) : posts.value,
)

function select(slug: string) {
  const query = { ...route.query }
  if (!slug || slug === activeSlug.value) delete query.slug
  else query.slug = slug
  void router.replace({ query })
}

onMounted(async () => {
  try {
    const [tagList, postPage] = await Promise.all([fetchTags(), fetchPosts({ pageSize: 50 })])
    tags.value = tagList
    posts.value = postPage.list
  } catch (err) {
    error.value = err instanceof Error ? err.message : '标签加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Tags</span>
      <h1 class="page-head__title">标签</h1>
      <p class="page-head__sub">按主题检索。数字是这个标签下的文章数。</p>
      <div v-if="tags.length" class="page-head__fields">
        <span class="arc-field">
          <span>{{ tags.length }} 个标签</span>
          <span>{{ posts.length }} 篇文章</span>
        </span>
      </div>
    </header>

    <div v-if="loading" class="flex flex-wrap gap-2" aria-hidden="true">
      <span v-for="i in 12" :key="i" class="skeleton" style="width: 84px; height: 30px" />
    </div>

    <div v-else-if="error" class="arc-empty">
      <span class="arc-empty__en">// Offline</span>
      <p>{{ error }}。请刷新页面重试。</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="arc-chip"
          :aria-pressed="!activeTag"
          @click="select('')"
        >
          全部
          <span class="arc-chip__count">{{ posts.length }}</span>
        </button>
        <button
          v-for="tag in sortedTags"
          :key="tag.id"
          type="button"
          class="arc-tag"
          :aria-pressed="activeSlug === tag.slug"
          @click="select(tag.slug)"
        >
          {{ tag.name }}
          <span class="arc-tag__count">{{ tag.postCount }}</span>
        </button>
      </div>

      <section class="filter-result" aria-labelledby="tag-result-heading">
        <div class="filter-result__head">
          <h2 id="tag-result-heading">{{ activeTag ? `# ${activeTag.name}` : '全部记录' }}</h2>
          <span class="arc-field">
            <span>{{ visiblePosts.length }} 篇</span>
          </span>
        </div>

        <div v-if="visiblePosts.length === 0" class="arc-empty">
          <span class="arc-empty__en">// Empty</span>
          <p>这个标签下还没有文章。</p>
        </div>
        <div v-else class="home-list">
          <RecordRow
            v-for="(post, index) in visiblePosts"
            :key="post.id"
            :post="post"
            :index="index + 1"
          />
        </div>
      </section>
    </template>
  </div>
</template>