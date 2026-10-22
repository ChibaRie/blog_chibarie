/**
 * 首页头图轮播验证：临时设置 3 张图 → 截图对比 → 自动恢复原配置
 */
import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:8081'
const SITE = 'http://localhost:5173'
const SHOTS = 'D:/Code/my_projects/blog_chibarie/.workbuddy/shots'
const USER = 'admin'
const PASS = 'admin123'

const TEST_IMAGES = [
  '/uploads/2026/09/1789796987-baf741ee33dd7cf8.jpg',
  '/uploads/2026/09/1789797499-3e3be12b989790de.jpg',
  '/uploads/2026/09/1789797165-65ff342d0ae41913.jpg',
]

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error(`${method} ${path}: ${data.message}`)
  return data.data
}

const token = (
  await api('POST', '/auth/login', { username: USER, password: PASS })
).token

const current = await api('GET', '/admin/settings', undefined, token)
const backup = {
  ...current.site,
  bilibili: current.site.socials?.bilibili ?? '',
  github: current.site.socials?.github ?? '',
  steam: current.site.socials?.steam ?? '',
  location: current.site.socials?.location ?? '',
}
console.log('已备份当前配置，原头图数量:', backup.heroBackgrounds?.length ?? 0)

await api(
  'PUT',
  '/admin/settings',
  { ...backup, heroBackgrounds: TEST_IMAGES },
  token,
)
console.log('已设置为 3 张测试头图')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage()

await page.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)

const heroHeight = await page.evaluate(() => {
  const hero = document.querySelector('section')
  return hero ? Math.round(hero.getBoundingClientRect().height) : 0
})
const viewportHeight = await page.evaluate(() => window.innerHeight)
console.log(`Hero 高度: ${heroHeight}px / 视口 ${viewportHeight}px`)

const dots = await page.locator('[aria-label^="切换到第"]').count()
console.log('指示点数量:', dots)

await page.screenshot({ path: `${SHOTS}/hero-slide-1.png` })

// 点第 3 个指示点，验证手动切换
if (dots >= 3) {
  await page.locator('[aria-label^="切换到第"]').nth(2).click()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${SHOTS}/hero-slide-3.png` })
  console.log('已点击第 3 个指示点')
}

await browser.close()

// 恢复原配置
await api('PUT', '/admin/settings', backup, token)
console.log('已恢复原配置，头图数量:', backup.heroBackgrounds?.length ?? 0)

const check = await api('GET', '/site/info')
console.log(
  '当前生效头图:',
  JSON.stringify(check.site.heroBackgrounds, null, 0),
)
