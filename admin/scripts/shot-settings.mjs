/**
 * 后台站点设置页：完整长图截图 + 失败请求清单
 */
import { chromium } from 'playwright-core'

const ADMIN = 'http://localhost:5174'
const SHOTS = 'D:/Code/my_projects/blog_chibarie/.workbuddy/shots'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
})
const page = await context.newPage()

const failures = []
page.on('response', (res) => {
  if (res.status() >= 400) {
    failures.push(`[${res.status()}] ${res.url()}`)
  }
})

await page.goto(`${ADMIN}/login`, { waitUntil: 'networkidle', timeout: 25000 })
await page.fill('input[placeholder="用户名"]', 'admin')
await page.fill('input[placeholder="密码"]', 'admin123')
await page.click('button:has-text("登录")')
await page.waitForTimeout(2500)

await page.goto(`${ADMIN}/settings`, { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(3000)

await page.screenshot({ path: `${SHOTS}/v2-admin-settings.png`, fullPage: true })

const sections = await page.evaluate(() =>
  [...document.querySelectorAll('.el-card__header')].map((el) =>
    (el.textContent || '').trim().slice(0, 20),
  ),
)

console.log('设置页包含的板块:')
for (const s of sections) console.log(`  - ${s}`)

console.log('')
console.log(`失败请求 ${failures.length} 条:`)
for (const f of failures) console.log(`  ${f}`)

await browser.close()
