import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../.workbuddy/shots')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE_URL || 'http://localhost:5174'
const USERNAME = process.env.ADMIN_USER || 'admin'
const PASSWORD = process.env.ADMIN_PASS || 'admin123'

// 文章编辑页的目标 ID 不写死：文章被删掉后写死的 ID 会 404，
// 之前就踩过两次（/posts/1/edit、/posts/2/edit）。登录后动态取现存的第一篇。
let postEditPath = null

const targets = [
  { path: '/', name: 'admin-dashboard' },
  { path: '/posts', name: 'admin-posts' },
  { path: '/posts/new', name: 'admin-post-new' },
  { path: () => postEditPath, name: 'admin-post-edit' },
  { path: '/categories', name: 'admin-categories' },
  { path: '/tags', name: 'admin-tags' },
  { path: '/links', name: 'admin-links' },
  { path: '/comments', name: 'admin-comments' },
  { path: '/settings', name: 'admin-settings' },
  { path: '/profile', name: 'admin-profile' },
]

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})

const page = await context.newPage()

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 25000 })
await page.fill('input[placeholder="用户名"]', USERNAME)
await page.fill('input[placeholder="密码"]', PASSWORD)
await page.click('button:has-text("登录")')
await page.waitForURL(`${BASE}/`, { timeout: 15000 })
console.log('登录成功')
await page.waitForTimeout(800)

// 取一篇现存的文章用于编辑页截图（避免写死 ID 再次失效）
postEditPath = await page.evaluate(async () => {
  try {
    const token = localStorage.getItem('chibarie-admin-token') || ''
    const res = await fetch('/api/admin/posts?page=1&pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const id = body?.data?.list?.[0]?.id
    return id ? `/posts/${id}/edit` : null
  } catch {
    return null
  }
})
if (postEditPath) {
  console.log(`编辑页目标：${postEditPath}`)
} else {
  console.log('警告：取不到现存文章，跳过编辑页截图')
}

for (const item of targets) {
  const path = typeof item.path === 'function' ? item.path() : item.path
  if (!path) continue
  const url = `${BASE}${path}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT_DIR}/pw-${item.name}.png` })
    console.log(`OK    ${item.name.padEnd(20)} ${url}`)
  } catch (err) {
    console.log(`FAIL  ${item.name.padEnd(20)} ${err.message}`)
  }
}

console.log('')
if (problems.length) {
  console.log('=== 页面问题 ===')
  for (const p of [...new Set(problems)]) console.log(p)
} else {
  console.log('没有控制台错误')
}

await browser.close()
