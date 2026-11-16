/**
 * 本地验收：断点、双主题、减少动效、交互与控制台错误。
 * 用法：node scripts/verify-redesign.mjs [baseUrl]
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../../.workbuddy/shots-redesign')
const BASE = process.argv[2] || 'http://localhost:4173'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

mkdirSync(OUT, { recursive: true })

const PAGES = [
  ['home', '/'],
  ['gallery', '/gallery'],
  ['post', '/post/python-basics-interpreter-syntax-sugar-decorators'],
  ['notes', '/notes'],
  ['archive', '/archive'],
  ['categories', '/categories'],
  ['tags', '/tags'],
  ['about', '/about'],
  ['links', '/links'],
  ['search', '/search?q=Vue'],
  ['notfound', '/no-such-page'],
]

const problems = []
const report = []

function watch(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[console] ${page.url()} ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`[pageerror] ${page.url()} ${err.message}`))
  page.on('requestfailed', (req) => {
    problems.push(`[requestfailed] ${req.url()} — ${req.failure()?.errorText}`)
  })
}

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1000)
}

async function inspect(page, name, width) {
  const data = await page.evaluate(() => {
    const root = document.documentElement
    const main = document.querySelector('main')
    return {
      theme: root.getAttribute('data-theme'),
      motion: root.getAttribute('data-motion'),
      scrollWidth: root.scrollWidth,
      innerWidth: window.innerWidth,
      mainText: (main?.innerText || '').slice(0, 80).replace(/\s+/g, ' '),
      imagesMissingAlt: [...document.images].filter((img) => !img.hasAttribute('alt')).length,
      h1: document.querySelectorAll('h1').length,
      headings: [...document.querySelectorAll('h1,h2')].slice(0, 6).map((el) => el.tagName + ':' + el.textContent.trim().slice(0, 24)),
    }
  })
  const overflow = data.scrollWidth > data.innerWidth + 1
  report.push({ page: name, width, overflow, ...data })
  if (overflow) problems.push(`[overflow] ${name} @${width} scrollWidth=${data.scrollWidth}`)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

// 1) 夜航 · 桌面 + 手机
for (const width of [1440, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 1440 ? 900 : 844 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  watch(page)
  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await inspect(page, name, width)
    await page.screenshot({ path: `${OUT}/${name}-${width}-night.png` })
    if (name === 'post') {
      await page.evaluate(() => document.querySelector('.article-body pre')?.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/post-${width}-night-code.png` })
    }
    if (['home', 'gallery', 'post'].includes(name)) {
      await page.screenshot({ path: `${OUT}/${name}-${width}-night-full.png`, fullPage: true })
    }
    if (name === 'home') {
      await page.evaluate(() => document.querySelector('.home-latest')?.scrollIntoView())
      await page.waitForTimeout(1100)
      await page.screenshot({ path: `${OUT}/home-${width}-night-latest.png` })
    }
    if (name === 'gallery') {
      await page.evaluate(() => window.scrollTo(0, 700))
      await page.waitForTimeout(1100)
      await page.screenshot({ path: `${OUT}/gallery-${width}-night-grid.png` })
    }
  }
  await context.close()
}

// 2) 纸白主题
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => localStorage.setItem('chibarie-theme', 'paper'))
  const page = await context.newPage()
  watch(page)
  for (const [name, path] of [['home', '/'], ['post', '/post/python-basics-interpreter-syntax-sugar-decorators'], ['gallery', '/gallery'], ['notes', '/notes']]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await inspect(page, `${name}-paper`, 1440)
    await page.screenshot({ path: `${OUT}/${name}-1440-paper.png` })
    if (name === 'post') {
      await page.evaluate(() => document.querySelector('.article-body pre')?.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/post-1440-paper-code.png` })
    }
    if (name === 'home' || name === 'gallery') {
      await page.evaluate(() => (document.querySelector('.home-latest') || document.querySelector('.stills-grid'))?.scrollIntoView())
      await page.waitForTimeout(1100)
      await page.screenshot({ path: `${OUT}/${name}-1440-paper-body.png` })
    }
  }
  await context.close()
}

// 3) 减少动效
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.screenshot({ path: `${OUT}/home-1440-reduced.png` })
  await context.close()
}

// 4) 交互：图库筛选 → 查看大图 → 键盘切换 → 关闭
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/gallery`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.getByRole('button', { name: /横构图/ }).click()
  await page.waitForTimeout(300)
  const filtered = await page.evaluate(() => document.querySelectorAll('.stills-grid__cell').length)
  await page.locator('.stills-grid__cell').first().click()
  await page.waitForTimeout(600)
  const opened = await page.evaluate(() => document.querySelector('dialog.image-viewer')?.open === true)
  await page.screenshot({ path: `${OUT}/viewer-1440-night.png` })
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  const counter = await page.locator('.image-viewer__meta').first().innerText()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const closed = await page.evaluate(() => document.querySelector('dialog.image-viewer')?.open !== true)
  const noParam = await page.evaluate(() => !new URL(location.href).searchParams.has('no'))
  report.push({ interaction: 'gallery', filtered, opened, counter, closed, noParam })
  if (!opened || !closed || !noParam) problems.push('[interaction] 图库查看器状态异常')
  await context.close()
}

// 5) 交互：外观面板 / 主题切换 / 移动菜单
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.getByRole('button', { name: '打开外观设置' }).click()
  await page.waitForTimeout(300)
  const panelOpen = await page.locator('#appearance-panel').isVisible()
  await page.screenshot({ path: `${OUT}/appearance-1440.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const panelClosed = !(await page.locator('#appearance-panel').isVisible())

  await page.getByRole('button', { name: /切换到纸白主题|切换到夜航主题/ }).click()
  await page.waitForTimeout(700)
  const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  await page.screenshot({ path: `${OUT}/home-1440-toggled.png` })
  report.push({ interaction: 'panels', panelOpen, panelClosed, themeAfter })
  if (!panelOpen || !panelClosed) problems.push('[interaction] 外观面板开关异常')
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  await page.getByRole('button', { name: '打开菜单' }).click()
  await page.waitForTimeout(400)
  const menuOpen = await page.evaluate(() => document.querySelector('#site-menu')?.open === true)
  await page.screenshot({ path: `${OUT}/menu-390-night.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const menuClosed = await page.evaluate(() => document.querySelector('#site-menu')?.open !== true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${OUT}/focus-390.png` })
  await page.getByRole('button', { name: '打开外观设置' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/appearance-390.png` })
  report.push({ interaction: 'mobile-menu', menuOpen, menuClosed })
  if (!menuOpen || !menuClosed) problems.push('[interaction] 移动菜单状态异常')
  await context.close()
}

// 6) 图库深链：?no=24 直接打开对应图版
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/gallery?no=24`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const open = await page.evaluate(() => document.querySelector('dialog.image-viewer')?.open === true)
  const label = await page.locator('.image-viewer__no').innerText().catch(() => '')
  report.push({ interaction: 'gallery-deeplink', open, label })
  if (!open || label.trim() !== 'No.024') problems.push('[interaction] 图库深链没有打开 No.024')
  await context.close()
}

// 7) 360 宽只查溢出
{
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
  const page = await context.newPage()
  watch(page)
  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await inspect(page, `${name}-360`, 360)
  }
  await context.close()
}

// 8) 键盘焦点：图库格子
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  watch(page)
  await page.goto(`${BASE}/gallery`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  let focused = ''
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab')
    focused = await page.evaluate(() => document.activeElement?.className || '')
    if (focused.includes('stills-grid__cell')) break
  }
  await page.screenshot({ path: `${OUT}/focus-gallery-cell.png` })
  report.push({ interaction: 'keyboard', focused: focused.includes('stills-grid__cell') })
  if (!focused.includes('stills-grid__cell')) problems.push('[keyboard] 无法用 Tab 到达图库格子')
  await context.close()
}

await browser.close()

// 9) 资源 404：图库清单 + 内容引用的图片
{
  const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../content/gallery.json'), 'utf8'))
  const index = JSON.parse(readFileSync(resolve(__dirname, '../src/generated/index.json'), 'utf8'))
  const urls = new Set()
  for (const item of manifest) {
    urls.add(item.thumb)
    urls.add(item.src)
    if (item.hero) urls.add(item.hero)
  }
  for (const post of index.posts) if (post.cover) urls.add(post.cover)
  for (const note of index.notes) for (const image of note.images) urls.add(image)
  for (const link of index.links) if (link.avatar) urls.add(link.avatar)
  if (index.site.avatar) urls.add(index.site.avatar)
  const list = [...urls]
  let failed = 0
  for (let i = 0; i < list.length; i += 12) {
    const batch = list.slice(i, i + 12)
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetch(BASE + url, { method: 'HEAD' })
          return res.ok ? null : `${res.status} ${url}`
        } catch (err) {
          return `${err.message} ${url}`
        }
      }),
    )
    for (const problem of results.filter(Boolean)) {
      failed += 1
      problems.push(`[asset] ${problem}`)
    }
  }
  report.push({ assets: list.length, failed })
}

console.log('')
console.log('=== 检查摘要 ===')
for (const row of report) console.log(JSON.stringify(row))
console.log('')
console.log(problems.length ? '=== 问题 ===\n' + [...new Set(problems)].join('\n') : '没有控制台错误、失败请求或横向溢出')
console.log(`\n截图目录：${OUT}`)