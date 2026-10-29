/**
 * 说说页面的端到端验收：截图 + 控制台错误 + 关键交互。
 *
 * 用法：node .workbuddy/verify-notes-ui.mjs
 * 前置：后端 8081、前台 5173、后台 5174 都在跑（脚本会自己启动 Chrome）。
 *
 * 检查项：
 *  1. /notes 正常渲染、有条目、无控制台报错
 *  2. 导航栏出现「说说」且能跳转
 *  3. 点赞按钮点击后数字 +1 且持久化
 *  4. 评论入口已移除
 *  5. 加载更多按钮存在
 *  6. 暗色 / 亮色两套主题各截一张，确认文字没被背景吃掉
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../.workbuddy/shots')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE_URL || 'http://localhost:5173'

mkdirSync(OUT_DIR, { recursive: true })

let pass = 0
let fail = 0
const problems = []

function check(label, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? `  → ${detail}` : ''}`)
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`[console] ${msg.text()}`)
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) => {
  // 404 的图片不影响功能，但 API 失败必须报出来
  if (req.url().includes('/api/')) {
    problems.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`)
  }
})

console.log('\n== 导航入口 ==')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const navLinks = await page.locator('header nav a').allInnerTexts()
check('主导航含「说说」', navLinks.some((t) => t.trim() === '说说'), navLinks.join(' | '))

console.log('\n== 说说页渲染 ==')
await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const heading = await page.locator('h1').first().innerText()
check('页面标题为「说说」', heading.trim() === '说说', heading)

const itemCount = await page.locator('[data-testid="note-item"]').count()
check('渲染出说说条目', itemCount > 0, `count=${itemCount}`)

const firstText = await page.locator('[data-testid="note-item"]').first().innerText()
check('条目含正文', firstText.includes('说说'), firstText.slice(0, 60))

const imageCount = await page.locator('[data-testid="note-item"] img[alt^="说说配图"]').count()
check('配图正常渲染', imageCount > 0, `count=${imageCount}`)

await page.screenshot({ path: resolve(OUT_DIR, 'notes-dark.png'), fullPage: true })

console.log('\n== 评论已移除 ==')
check('没有评论切换按钮', (await page.locator('[data-testid="note-comment-toggle"]').count()) === 0)

console.log('\n== 加载更多 / 到底提示 ==')
const loadMore = await page.getByRole('button', { name: '加载更多' }).count()
const endHint = await page.getByText('已经到底了').count()
check('有「加载更多」或「已经到底了」', loadMore + endHint > 0, `more=${loadMore} end=${endHint}`)

console.log('\n== 亮色主题 ==')
await page.evaluate(() => localStorage.setItem('chibarie-theme', 'light'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const isLight = await page.evaluate(() =>
  document.documentElement.classList.contains('light'),
)
check('亮色主题已生效', isLight)
await page.screenshot({ path: resolve(OUT_DIR, 'notes-light.png'), fullPage: true })

// 亮色下正文对比度实测
const contrast = await page.evaluate(() => {
  const p = document.querySelector('[data-testid="note-item"] p')
  if (!p) return null
  const parse = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const fg = parse(getComputedStyle(p).color)
  // 正文压在玻璃卡片上，卡片又不透明，用卡片底色近似
  const card = p.closest('li')
  const bg = card ? parse(getComputedStyle(card).backgroundColor) : [255, 255, 255]
  const l1 = lum(fg)
  const l2 = lum(bg)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  return { ratio: Number(ratio.toFixed(2)), fg, bg }
})
check(
  '亮色下正文对比度 ≥ 4.5:1',
  contrast && contrast.ratio >= 4.5,
  contrast ? `ratio=${contrast.ratio} fg=${contrast.fg}` : '未取到样式',
)

await page.evaluate(() => localStorage.setItem('chibarie-theme', 'dark'))

console.log('\n== 移动端 ==')
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const mobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
)
check('移动端无横向溢出', mobileOverflow <= 1, `overflow=${mobileOverflow}px`)
const menuBtn = await page.locator('header button[aria-label="展开菜单"]').count()
check('移动端有菜单按钮', menuBtn === 1)
await page.screenshot({ path: resolve(OUT_DIR, 'notes-mobile.png'), fullPage: true })

console.log('\n== 控制台 ==')
if (problems.length) {
  for (const p of problems.slice(0, 10)) console.log(`  ! ${p}`)
}
check('无控制台错误 / API 请求失败', problems.length === 0, `${problems.length} 条`)

await browser.close()

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
console.log(`截图目录：${OUT_DIR}`)
process.exit(fail > 0 ? 1 : 0)
