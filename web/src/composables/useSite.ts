import { onMounted, ref } from 'vue'
import { fetchSiteInfo } from '@/api'
import type { SiteInfo } from '@/api'

const siteInfo = ref<SiteInfo | null>(null)
let loaded = false

async function load(force = false) {
  if (loaded && !force) return
  try {
    siteInfo.value = await fetchSiteInfo()
    loaded = true
  } catch (err) {
    console.error('[site] 加载站点信息失败', err)
  }
}

export function useSite() {
  onMounted(() => {
    void load()
  })
  return { siteInfo }
}
