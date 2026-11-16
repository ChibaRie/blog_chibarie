<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCategories, fetchPosts, type Category, type Post } from '@/api'
import RecordRow from '@/components/RecordRow.vue'
import { formatIndex } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const categories = ref<Category[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const error = ref('')

const activeSlug = computed(() => String(route.query.slug || ''))
const activeCategory = computed(
  () => categories.value.find((category) => category.slug === activeSlug.value) || null,
)
const visiblePosts = computed(() =>
  activeCategory.value
    ? posts.value.filter((post) => post.categoryId === activeCategory.value?.id)
    : posts.value,
)
const totalPosts = computed(() => posts.value.length)

function select(slug: string) {
  const query = { ...route.query }
  if (!slug || slug === activeSlug.value) delete query.slug
  else query.slug = slug
  void router.replace({ query })
}

onMounted(async () => {
  try {
    const [categoryList, postPage] = await Promise.all([
      fetchCategories(),
      fetchPosts({ pageSize: 50 }),
    ])
    categories.value = categoryList
    posts.value = postPage.list
  } catch (err) {
    error.value = err instanceof Error ? err.message : '分类加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="shell">
    <header class="page-head">
      <span class="page-head__en">// Sections</span>
      <h1 class="page-head__title">分类</h1>
      <p class="page-head__sub">按内容方向分组。点一行筛选下面的记录，再点一次取消。</p>
      <div v-if="categories.length" class="page-head__fields">
        <span class="arc-field">
          <span>{{ categories.length }} 个分类</span>
          <span>{{ totalPosts }} 篇文章</span>
        </span>
      </div>
    </header>

    <div v-if="loading" aria-hidden="true">
      <div v-for="i in 4" :key="i" class="skeleton skeleton--row" />
    </div>

    <div v-else-if="error" class="arc-empty">
      <span class="arc-empty__en">// Offline</span>
      <p>{{ error }}。请刷新页面重试。</p>
    </div>

    <template v-else>
      <div class="index-rows" role="group" aria-label="按分类筛选">
        <button
          v-for="(category, index) in categories"
          :key="category.id"
          type="button"
          class="index-row"
          :aria-pressed="activeSlug === category.slug"
          @click="select(category.slug)"
        >
          <span class="index-row__no" aria-hidden="true">{{ formatIndex(index + 1) }}</span>
          <span class="index-row__name">{{ category.name }}</span>
          <span class="index-row__desc">{{ category.description }}</span>
          <span class="index-row__count" :aria-label="`${category.postCount} 篇文章`">
            {{ formatIndex(category.postCount) }}
          </span>
        </button>
      </div>

      <section class="filter-result" aria-labelledby="filter-heading">
        <div class="filter-result__head">
          <h2 id="filter-heading">
            {{ activeCategory ? activeCategory.name : '全部记录' }}
          </h2>
          <span class="arc-field">
            <span>{{ visiblePosts.length }} 篇</span>
            <span v-if="activeCategory">{{ activeCategory.slug }}</span>
          </span>
        </div>

        <div v-if="visiblePosts.length === 0" class="arc-empty">
          <span class="arc-empty__en">// Empty</span>
          <p>这个分类下还没有文章。</p>
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