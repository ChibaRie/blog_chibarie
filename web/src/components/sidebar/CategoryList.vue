<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchCategories, type Category } from '@/api'
import PanelCard from './PanelCard.vue'

const categories = ref<Category[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    categories.value = await fetchCategories()
  } catch (err) {
    console.error('[categories] 加载失败', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <PanelCard title="分类">
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 3"
        :key="i"
        class="h-8 animate-pulse rounded-lg bg-night-700/50"
      />
    </div>

    <ul v-else class="space-y-0.5">
      <li v-for="item in categories" :key="item.id">
        <RouterLink
          :to="`/categories?slug=${item.slug}`"
          class="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-mist-300 transition-colors duration-200 hover:bg-sakura-500/10 hover:text-sakura-200"
        >
          <span>{{ item.name }}</span>
          <span
            class="rounded-full bg-cosmos-600/30 px-2 py-0.5 text-[12px] text-cosmos-200"
          >
            {{ item.postCount }}
          </span>
        </RouterLink>
      </li>
    </ul>
  </PanelCard>
</template>
