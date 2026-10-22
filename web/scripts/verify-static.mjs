/**
 * 静态站冒烟检查：真实 Chromium 逐页访问，检查渲染、资源、API 泄漏。
 * 用法：node scripts/verify-static.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'

const BASE = (process.argv[2] || 'http://localhost:4173/blog_chibarie').replace(/\/$/, '')
const CHROME_PATH =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const routes = [
  { path: '/', expect: '最新文章' },
  { path: '/post/vue3-composition-api-post-list', expect: '组合式 API' },
  { path: '/post/comfyui-local-diffusion-control', expect: 'ComfyUI' },
  { path: '/notes', expect: '说说' },
  { path: '/archive', expect: '归档' },
  { path: '/categories', expect: '分类' },
  { path: '/tags', expect: '标签' },
  { path: '/links', expect: '友链' },
  { path: '/about', expect: '关于' },
  { path: '/search', expect: '搜索' },
  { path: '/no-such-page', expect: '这里什么都没有', status: [200, 404] },
]

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const failures = []
const apiRequests = []

page.on('pageerror', (error) => failures.push(`[pageerror] ${error.message}`))
const siteOrigin = new URL(BASE).origin
page.on('request', (request) => {
  const url = new URL(request.url())
  if (url.origin === siteOrigin && url.pathname.startsWith('/api/')) {
    apiRequests.push(request.url())
  }
})
page.on('requestfailed', (request) => {
  failures.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`)
})

for (const route of routes) {
  const url = `${BASE}${route.path}`
  const errors = []
  const onConsole = (message) => {
    if (message.type() !== 'error') return
    // 404 路由本身会触发浏览器的资源加载错误；资源缺失由 requestfailed/图片检查兜底
    if (message.text().includes('Failed to load resource')) return
    errors.push(message.text())
  }
  page.on('console', onConsole)

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const title = await page.title()
    const text = await page.locator('body').innerText()
    const found = text.includes(route.expect)

    const expectedStatuses = Array.isArray(route.status) ? route.status : [route.status || 200]
    if (!response || !expectedStatuses.includes(response.status())) {
      failures.push(
        `[status] ${route.path} -> ${response?.status()} (expected ${expectedStatuses.join('/')})`,
      )
    }
    if (!found) failures.push(`[expect] ${route.path} 缺少 "${route.expect}"`)
    if (!title) failures.push(`[title] ${route.path} 为空`)
    if (text.trim().length < 40) failures.push(`[empty] ${route.path} 正文过短`)
    if (errors.length) failures.push(`[console] ${route.path} ${errors.join(' | ')}`)

    console.log(`OK  ${route.path.padEnd(42)} ${title}`)
  } catch (error) {
    failures.push(`[goto] ${route.path} ${error.message}`)
    console.log(`FAIL ${route.path} ${error.message}`)
  } finally {
    page.off('console', onConsole)
  }
}

// 首页实际渲染出的文章数量
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const postLinks = await page.locator('a[href*="/post/"]').count()
console.log(`home post links: ${postLinks}`)
if (postLinks < 9) failures.push(`[home] 文章链接只有 ${postLinks} 个`)

// 文章页正文与图片
await page.goto(`${BASE}/post/agentcraft-project`, { waitUntil: 'networkidle' })
const articleLength = (await page.locator('.article-body').innerText()).length
const brokenImages = await page.$$eval('img', (images) =>
  images
    .filter((image) => Boolean(image.src))
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => image.src),
)
console.log(`article chars: ${articleLength}, broken images: ${brokenImages.length}`)
if (articleLength < 500) failures.push(`[article] 正文过短：${articleLength}`)
for (const image of brokenImages) failures.push(`[image] ${image}`)

// 搜索
await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' })
await page.locator('input[type="search"]').fill('Vue')
await page.waitForTimeout(800)
const searchText = await page.locator('body').innerText()
console.log(`search has result: ${searchText.includes('组合式 API')}`)
if (!searchText.includes('组合式 API')) failures.push('[search] 未搜到 Vue 文章')

if (apiRequests.length) failures.push(`[api] 仍存在 API 请求：${apiRequests.join(', ')}`)

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log('\nAll static checks passed.')
