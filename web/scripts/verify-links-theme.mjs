/**
 * 友链页 + 主题切换动画验证。
 * 动画没法直接截图成动图，就在点击后按时间点连拍，
 * 从中间帧能看到「新主题从点击处扩散铺开」的过程。
 * 用法：node scripts/verify-links-theme.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(__dirname, '../../.workbuddy/shots')
mkdirSync(SHOTS, { recursive: true })

const BASE = process.env.BASE || 'http://localhost:5173'
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('requestfailed', (r) => {
  // 排除已知的境外 CDN（md-editor-v3 的依赖，仅后台会用）
  if (r.url().includes('unpkg.com')) return
  errors.push(`requestfailed ${r.url()}`)
})

console.log('=== 1. 友链页（暗色）===')
await page.goto(`${BASE}/links`, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1800)
const cards = await page.locator('a[href^="http"]').count()
console.log(`  友链卡片：${cards} 张`)
const navTexts = await page.evaluate(() =>
  [...document.querySelectorAll('header nav a')].map((a) => a.textContent?.trim()),
)
console.log(`  导航项：${navTexts.join(' / ')}`)
await page.screenshot({ path: resolve(SHOTS, 'links-dark.png') })

console.log('\n=== 2. 主题切换动画（连拍中间帧）===')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1800)

const support = await page.evaluate(() => ({
  vt: typeof document.startViewTransition === 'function',
  prop: typeof CSS !== 'undefined' && 'registerProperty' in CSS,
}))
console.log(`  View Transitions 支持: ${support.vt ? '✓' : '✗'}，@property 支持: ${support.prop ? '✓' : '✗'}`)

// 切到亮色
await page.click('.theme-toggle')
await page.waitForTimeout(180)
await page.screenshot({ path: resolve(SHOTS, 'theme-anim-1.png') })
await page.waitForTimeout(200)
await page.screenshot({ path: resolve(SHOTS, 'theme-anim-2.png') })
await page.waitForTimeout(320)
await page.screenshot({ path: resolve(SHOTS, 'theme-anim-3.png') })
await page.waitForTimeout(600)
const afterClick = await page.evaluate(() => document.documentElement.className)
console.log(`  切换后 html.class = "${afterClick}" ${afterClick.includes('light') ? '✓' : '✗'}`)

// 再切回暗色，同样连拍
await page.click('.theme-toggle')
await page.waitForTimeout(180)
await page.screenshot({ path: resolve(SHOTS, 'theme-anim-back-1.png') })
await page.waitForTimeout(600)

const back = await page.evaluate(() => document.documentElement.className)
console.log(`  切回后 html.class = "${back}" ${!back.includes('light') ? '✓' : '✗'}`)

console.log('\n=== 3. 友链页（亮色）===')
await page.goto(`${BASE}/links`, { waitUntil: 'networkidle', timeout: 40000 })
await page.evaluate(() => localStorage.setItem('chibarie-theme', 'light'))
await page.reload({ waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1800)
await page.screenshot({ path: resolve(SHOTS, 'links-light.png') })

console.log(`\n控制台错误：${errors.length} 条`)
for (const e of [...new Set(errors)].slice(0, 6)) console.log(`  - ${e}`)

await browser.close()
