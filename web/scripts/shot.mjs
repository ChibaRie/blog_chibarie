import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../.workbuddy/shots')

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE_URL || 'http://localhost:5173'

const targets = [
  { path: '/', name: 'home' },
  { path: '/archive', name: 'archive' },
  { path: '/categories', name: 'categories' },
  { path: '/tags', name: 'tags' },
  { path: '/links', name: 'links' },
  { path: '/about', name: 'about' },
  { path: '/search', name: 'search' },
  { path: '/post/comfyui-local-diffusion-control', name: 'post' },
  { path: '/post/go-concurrency-basics', name: 'post-go' },
  { path: '/no-such-page', name: 'notfound' },
]

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
})

const page = await context.newPage()

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) => {
  problems.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText}`)
})

for (const item of targets) {
  const url = `${BASE}${item.path}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT_DIR}/pw-${item.name}.png` })
    console.log(`OK    ${item.name.padEnd(12)} ${url}`)
  } catch (err) {
    console.log(`FAIL  ${item.name.padEnd(12)} ${err.message}`)
  }
}

console.log('')
if (problems.length) {
  console.log('=== 页面问题 ===')
  for (const p of [...new Set(problems)]) console.log(p)
} else {
  console.log('没有控制台错误或失败请求')
}

await browser.close()
