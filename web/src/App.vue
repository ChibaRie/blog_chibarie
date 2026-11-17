<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import AppearancePanel from '@/components/AppearancePanel.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import RouteCurtain from '@/components/RouteCurtain.vue'
import { useSite } from '@/composables/useSite'
import { withBase } from '@/utils/asset'

const route = useRoute()
const { siteInfo } = useSite()
const pageBackground = computed(
  () => siteInfo.value?.site.pageBackground || withBase('/gallery/thumb/058.webp'),
)
</script>

<template>
  <div
    class="site-canvas"
    :style="{ backgroundImage: `url(${pageBackground})` }"
    aria-hidden="true"
  />

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
  <RouteCurtain />
</template>
