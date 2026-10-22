/**
 * 封面上传端到端测试：
 * 登录后台 → 打开文章编辑器 → 上传封面 → 截图 → 保存 → 验证文件落盘与前台展示
 */
import { chromium } from 'playwright-core'
import { existsSync, readdirSync } from 'node:fs'

const ADMIN = 'http://localhost:5174'
const SHOTS = 'D:/Code/my_projects/blog_chibarie/.workbuddy/shots'
const TEST_IMAGE = 'D:/Code/my_projects/blog_chibarie/web/public/images/bg-hero.jpg'
const POST_ID = process.env.POST_ID || '23'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))
page.on('response', async (res) => {
  if (res.url().includes('/api/admin/upload')) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 160)
    } catch {
      body = '<读取失败>'
    }
    console.log(`[upload] ${res.status()} ${body}`)
  }
})

// 登录
await page.goto(`${ADMIN}/login`, { waitUntil: 'networkidle', timeout: 25000 })
await page.fill('input[placeholder="用户名"]', 'admin')
await page.fill('input[placeholder="密码"]', 'admin123')
await page.click('button:has-text("登录")')
await page.waitForTimeout(2500)
console.log('登录完成，URL:', page.url())

// 打开编辑器
await page.goto(`${ADMIN}/posts/${POST_ID}/edit`, {
  waitUntil: 'networkidle',
  timeout: 25000,
})
await page.waitForTimeout(2200)

const uploaderCount = await page.locator('.cover-uploader input[type=file]').count()
console.log('封面上传控件数量:', uploaderCount)

await page.screenshot({ path: `${SHOTS}/cover-1-before.png` })

// 上传封面
await page.locator('.cover-uploader input[type=file]').setInputFiles(TEST_IMAGE)
await page.waitForTimeout(3500)

await page.screenshot({ path: `${SHOTS}/cover-2-uploaded.png` })

const previewSrc = await page
  .locator('.cover-preview img')
  .getAttribute('src')
  .catch(() => null)
console.log('封面预览 src:', previewSrc || '(未出现预览)')

// 保存
const publishBtn = page.locator('button:has-text("发布")').first()
if (await publishBtn.count()) {
  await publishBtn.click()
  await page.waitForTimeout(2500)
  console.log('已点击保存，URL:', page.url())
} else {
  console.log('未找到发布按钮')
}

await browser.close()

// 验证文件确实落到 uploads
const today = new Date()
const dir = `D:/Code/my_projects/blog_chibarie/server/uploads/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
if (existsSync(dir)) {
  const files = readdirSync(dir).sort()
  console.log('')
  console.log(`uploads 目录 ${dir} 共 ${files.length} 个文件，最新 3 个：`)
  console.log(' ', files.slice(-3).join('\n  '))
}

console.log('')
console.log('测试图片存在:', existsSync(TEST_IMAGE))
