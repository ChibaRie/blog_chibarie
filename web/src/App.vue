<script setup lang="ts">
import { RouterView } from 'vue-router'
import BackdropLayer from '@/components/BackdropLayer.vue'
import FallingPetals from '@/components/FallingPetals.vue'
import PageLoader from '@/components/PageLoader.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import AppearancePanel from '@/components/AppearancePanel.vue'
import { useAppearance } from '@/composables/useAppearance'

const { settings } = useAppearance()
</script>

<template>
  <div class="relative min-h-screen">
    <BackdropLayer />
    <FallingPetals :enabled="settings.showParticles" />

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
    <AppearancePanel />
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
