<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import AppearancePanel from '@/components/AppearancePanel.vue'
import ImageViewer from '@/components/ImageViewer.vue'

const route = useRoute()
</script>

<template>
  <a class="skip-link" href="#main">跳到正文</a>

  <SiteHeader />

  <main id="main" tabindex="-1" class="scroll-mt-24">
    <RouterView v-slot="{ Component }">
      <Transition name="shutter" mode="out-in">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </main>

  <SiteFooter />
  <AppearancePanel />
  <ImageViewer />
</template>