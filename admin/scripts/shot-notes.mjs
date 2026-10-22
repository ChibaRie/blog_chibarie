import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../.workbuddy/shots')
mkdirSync(OUT_DIR, { recursive: true })

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[placeholder="用户名"]', 'admin')
await page.fill('input[placeholder="密码"]', 'admin123')
await page.click('button:has-text("登录")')
await page.waitForURL(`${BASE}/`)
await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const rows = await page.locator('.el-table__body tbody tr').count()
console.log('说说管理行数:', rows)
await page.screenshot({ path: `${OUT_DIR}/admin-notes-list.png`, fullPage: true })

// 亮色主题下也确认一下
await page.evaluate(() => {
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.add('light')
})
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT_DIR}/admin-notes-list-light.png` })

await browser.close()
console.log('截图完成')
