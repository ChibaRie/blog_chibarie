import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

page.on('response', async (res) => {
  if (res.url().includes('/api/')) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 300)
    } catch {
      body = '<无法读取>'
    }
    console.log(`[api] ${res.status()} ${res.request().method()} ${res.url()}`)
    console.log(`      ${body}`)
  }
})
page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))

await page.goto('http://localhost:5174/login', {
  waitUntil: 'networkidle',
  timeout: 25000,
})

await page.fill('input[placeholder="用户名"]', 'admin')
await page.fill('input[placeholder="密码"]', 'admin123')
await page.click('button:has-text("登录")')

await page.waitForTimeout(4000)

console.log('=== 登录后 URL ===')
console.log(page.url())
console.log('=== localStorage token ===')
console.log(
  await page.evaluate(() => localStorage.getItem('chibarie-admin-token')?.slice(0, 40) || '(空)'),
)

await page.screenshot({ path: '../.workbuddy/shots/admin-login-debug.png' })

await browser.close()
