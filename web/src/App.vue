<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import BackdropLayer from '@/components/BackdropLayer.vue'
import FallingPetals from '@/components/FallingPetals.vue'
import PageLoader from '@/components/PageLoader.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'

const route = useRoute()

// 长文阅读页压暗背景，其余页面让插画透出来
const backdropIntensity = computed<'soft' | 'strong'>(() =>
  route.name === 'post' ? 'strong' : 'soft',
)
</script>

<template>
  <div class="relative min-h-screen">
    <BackdropLayer :intensity="backdropIntensity" />
    <FallingPetals />

    <div class="relative z-10 flex min-h-screen flex-col">
      <SiteHeader />
      <main class="flex-1">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
      <SiteFooter />
    </div>

    <PageLoader />
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
