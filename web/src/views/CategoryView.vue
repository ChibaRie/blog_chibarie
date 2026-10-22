<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCategories, fetchPosts, type Category, type Post } from '@/api'
import ArticleCard from '@/components/ArticleCard.vue'

const route = useRoute()
const router = useRouter()

const categories = ref<Category[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const postsLoading = ref(false)

const activeSlug = computed(() => (route.query.slug as string) || '')
const activeCategory = computed(
  () => categories.value.find((c) => c.slug === activeSlug.value) || null,
)

async function loadPosts() {
  if (!activeCategory.value) {
    posts.value = []
    return
  }
  postsLoading.value = true
  try {
    const res = await fetchPosts({
      categoryId: activeCategory.value.id,
      pageSize: 50,
    })
    posts.value = res.list
  } catch (err) {
    console.error('[category] 加载文章失败', err)
  } finally {
    postsLoading.value = false
  }
}

function selectCategory(slug: string) {
  const next = slug === activeSlug.value ? {} : { slug }
  void router.push({ path: '/categories', query: next })
}

onMounted(async () => {
  try {
    categories.value = await fetchCategories()
    await loadPosts()
  } catch (err) {
    console.error('[categories] 加载失败', err)
  } finally {
    loading.value = false
  }
})

watch(activeSlug, () => void loadPosts())
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <header class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">分类</h1>
      <p class="mt-2 text-sm text-mist-500">
        共 {{ categories.length }} 个分类，点击查看该分类下的文章
      </p>
    </header>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="glass-card h-28 animate-pulse" />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="item in categories"
        :key="item.id"
        class="glass-card glass-card-hover group p-5 text-left"
        :class="
          activeSlug === item.slug
            ? 'border-sakura-400/45 bg-sakura-500/10 shadow-glow'
            : ''
        "
        @click="selectCategory(item.slug)"
      >
        <div class="flex items-start justify-between gap-3">
          <h2
            class="text-base font-medium transition-colors"
            :class="
              activeSlug === item.slug
                ? 'text-sakura-200'
                : 'text-mist-100 group-hover:text-sakura-200'
            "
          >
            {{ item.name }}
          </h2>
          <span
            class="shrink-0 rounded-full bg-cosmos-600/30 px-2 py-0.5 text-[12px] text-cosmos-200"
          >
            {{ item.postCount }}
          </span>
        </div>
        <p v-if="item.description" class="mt-2 line-clamp-2 text-xs leading-relaxed text-mist-500">
          {{ item.description }}
        </p>
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
    >
      <section v-if="activeCategory" class="mt-10">
        <div class="mb-5 flex items-center gap-3">
          <h2 class="section-label">{{ activeCategory.name }}</h2>
          <span class="h-px flex-1 bg-mist-400/12" />
          <button
            class="text-xs text-mist-500 transition-colors hover:text-sakura-200"
            @click="selectCategory(activeCategory.slug)"
          >
            收起
          </button>
        </div>

        <div v-if="postsLoading" class="space-y-4">
          <div v-for="i in 2" :key="i" class="glass-card h-32 animate-pulse" />
        </div>

        <div v-else-if="posts.length === 0" class="glass-card p-8 text-center text-sm text-mist-500">
          该分类下还没有文章。
        </div>

        <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ArticleCard v-for="post in posts" :key="post.id" :post="post" />
        </div>
      </section>
    </Transition>
  </div>
</template>
