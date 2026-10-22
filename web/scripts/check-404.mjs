import { chromium } from 'playwright-core'

const PAGES = [
  '/',
  '/archive',
  '/post/comfyui-local-diffusion-control',
]
const BASE = 'http://localhost:5173'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage()

const failures = []

page.on('response', (res) => {
  if (res.status() >= 400) {
    failures.push({ url: res.url(), status: res.status(), page: page.url() })
  }
})

for (const path of PAGES) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 25000 })
  await page.waitForTimeout(900)
}

await browser.close()

if (failures.length === 0) {
  console.log('无失败请求')
} else {
  console.log(`失败请求 ${failures.length} 条：`)
  for (const f of failures) {
    console.log(`  [${f.status}] ${f.url}`)
    console.log(`        来源页: ${f.page}`)
  }
}
