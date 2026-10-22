<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchPosts, fetchTags, type Post, type Tag } from '@/api'
import ArticleCard from '@/components/ArticleCard.vue'

const route = useRoute()
const router = useRouter()

const tags = ref<Tag[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const postsLoading = ref(false)

const activeSlug = computed(() => (route.query.slug as string) || '')
const activeTag = computed(
  () => tags.value.find((t) => t.slug === activeSlug.value) || null,
)

const sortedTags = computed(() =>
  [...tags.value].sort((a, b) => b.postCount - a.postCount || a.id - b.id),
)

async function loadPosts() {
  if (!activeTag.value) {
    posts.value = []
    return
  }
  postsLoading.value = true
  try {
    const res = await fetchPosts({
      tagId: activeTag.value.id,
      pageSize: 50,
    })
    posts.value = res.list
  } catch (err) {
    console.error('[tag] 加载文章失败', err)
  } finally {
    postsLoading.value = false
  }
}

function selectTag(slug: string) {
  const next = slug === activeSlug.value ? {} : { slug }
  void router.push({ path: '/tags', query: next })
}

onMounted(async () => {
  try {
    tags.value = await fetchTags()
    await loadPosts()
  } catch (err) {
    console.error('[tags] 加载失败', err)
  } finally {
    loading.value = false
  }
})

watch(activeSlug, () => void loadPosts())
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6">
    <header class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-mist-100">标签</h1>
      <p class="mt-2 text-sm text-mist-500">
        共 {{ tags.length }} 个标签，点击筛选文章
      </p>
    </header>

    <div v-if="loading" class="flex flex-wrap gap-2">
      <div
        v-for="i in 8"
        :key="i"
        class="h-8 w-20 animate-pulse rounded-full bg-night-700/40"
      />
    </div>

    <div v-else class="glass-card p-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in sortedTags"
          :key="tag.id"
          class="tag-pill tag-pill-hover transition-all duration-200"
          :class="
            activeSlug === tag.slug
              ? 'border-sakura-400/50 bg-sakura-500/22 text-sakura-200'
              : ''
          "
          @click="selectTag(tag.slug)"
        >
          {{ tag.name }}
          <span class="text-[11px] opacity-70">{{ tag.postCount }}</span>
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
    >
      <section v-if="activeTag" class="mt-10">
        <div class="mb-5 flex items-center gap-3">
          <h2 class="section-label"># {{ activeTag.name }}</h2>
          <span class="h-px flex-1 bg-mist-400/12" />
          <button
            class="text-xs text-mist-500 transition-colors hover:text-sakura-200"
            @click="selectTag(activeTag.slug)"
          >
            收起
          </button>
        </div>

        <div v-if="postsLoading" class="space-y-4">
          <div v-for="i in 2" :key="i" class="glass-card h-32 animate-pulse" />
        </div>

        <div v-else-if="posts.length === 0" class="glass-card p-8 text-center text-sm text-mist-500">
          该标签下还没有文章。
        </div>

        <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ArticleCard v-for="post in posts" :key="post.id" :post="post" />
        </div>
      </section>
    </Transition>
  </div>
</template>
