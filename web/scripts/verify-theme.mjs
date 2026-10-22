/**
 * 验证日间/夜间主题切换。
 * 流程：清空偏好 → 断言默认暗色 → 点击切换 → 断言亮色并校验对比度
 *      → 刷新验证持久化 → 亮色下遍历页面 → 切回暗色 → 截图
 * 用法：node scripts/verify-theme.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(__dirname, '../../.workbuddy/shots')
mkdirSync(SHOTS, { recursive: true })

const BASE = process.env.BASE || 'http://localhost:5173'
const PAGES = [
  '/',
  '/archive',
  '/categories',
  '/tags',
  '/post/markdown-styling-reference',
  '/about',
]

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
})

const parseRgb = (str) => {
  if (!str) return null
  const m = str.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  return m[1].split(',').slice(0, 3).map((v) => parseFloat(v))
}
const alphaOf = (str) => {
  const m = str && str.match(/rgba\([^)]+,\s*([\d.]+)\)/)
  return m ? parseFloat(m[1]) : 1
}
const luminance = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}
/** 半透明色叠到页面底色上，估出实际观感色 */
const flatten = (fg, bg, base) => {
  const a = alphaOf(bg)
  const b = parseRgb(bg)
  return a >= 1 ? b : b.map((v, i) => v * a + base[i] * (1 - a))
}

async function sample() {
  return page.evaluate(() => {
    const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null)
    const panel =
      document.querySelector('.glass-card') || document.querySelector('.glass')
    const header = document.querySelector('header')
    return {
      htmlClass: document.documentElement.className,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      panelBg: cs(panel, 'backgroundColor'),
      panelText: cs(panel, 'color'),
      navText: cs(document.querySelector('header a.nav-link'), 'color'),
      headerBg: cs(header, 'backgroundColor'),
      toggle: !!document.querySelector('.theme-toggle'),
      themeColorMeta: document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
    }
  })
}

const ok = (b) => (b ? '✓' : '✗')

console.log('=== 1. 首次访问（无本地偏好）应默认暗色 ===')
// 先清一次偏好再刷新，模拟全新访客（只在开头做，后续导航不能重复清）
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 40000 })
await page.evaluate(() => localStorage.removeItem('chibarie-theme'))
await page.reload({ waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(2600)
const dark = await sample()
console.log(`  html.class        : "${dark.htmlClass}"  ${ok(!dark.htmlClass.includes('light'))}`)
console.log(`  body 背景         : ${dark.bodyBg}`)
console.log(`  body 文字         : ${dark.bodyColor}`)
console.log(`  卡片背景          : ${dark.panelBg}`)
console.log(`  切换按钮存在      : ${ok(dark.toggle)}`)
console.log(`  theme-color meta  : ${dark.themeColorMeta}`)
console.log(`  暗色底够深        : ${ok(luminance(parseRgb(dark.bodyBg)) < 0.1)}`)
await page.screenshot({ path: resolve(SHOTS, 'theme-dark-home.png') })

console.log('\n=== 2. 点击切换 → 亮色 ===')
await page.click('.theme-toggle')
await page.waitForTimeout(1100)
const light = await sample()
console.log(`  html.class        : "${light.htmlClass}"  ${ok(light.htmlClass.includes('light'))}`)
console.log(`  body 背景         : ${light.bodyBg}  亮度 ${luminance(parseRgb(light.bodyBg)).toFixed(3)}`)
console.log(`  body 文字         : ${light.bodyColor}`)
console.log(`  卡片背景          : ${light.panelBg}`)
console.log(`  localStorage      : ${await page.evaluate(() => localStorage.getItem('chibarie-theme'))}`)
console.log(`  背景已变化        : ${ok(dark.bodyBg !== light.bodyBg)}`)
console.log(`  文字已变化        : ${ok(dark.bodyColor !== light.bodyColor)}`)
console.log(`  亮色底够浅        : ${ok(luminance(parseRgb(light.bodyBg)) > 0.6)}`)

console.log('\n=== 3. 亮色对比度（半透明底已折算）===')
const base = parseRgb(light.bodyBg)
const pairs = [
  ['正文/卡片', light.panelText, flatten(light.panelText, light.panelBg, base)],
  ['导航项/页面', light.navText, base],
  ['正文/页面', light.bodyColor, base],
]
for (const [name, fg, bg] of pairs) {
  if (!fg || !bg) continue
  const ratio = contrast(parseRgb(fg), bg)
  const mark = ratio >= 4.5 ? '✓' : ratio >= 3 ? '△ 大字可接受' : '✗ 不达标'
  console.log(`  ${name.padEnd(10)} ${ratio.toFixed(2)}:1  ${mark}`)
}
await page.screenshot({ path: resolve(SHOTS, 'theme-light-home.png') })

console.log('\n=== 4. 刷新后持久化 ===')
await page.reload({ waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1800)
const reloaded = await sample()
console.log(
  `  html.class : "${reloaded.htmlClass}"  ${ok(reloaded.htmlClass.includes('light'))}`,
)

console.log('\n=== 4b. 亮色下预加载遮罩不应闪暗 ===')
// 尽早抓一次：此时 PageLoader 仍在显示
const early = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 40000 })
void early
await page.waitForTimeout(220)
const loader = await page.evaluate(() => {
  const el = document.querySelector('.fixed.inset-0.z-\\[100\\]')
  if (!el) return { present: false }
  return {
    present: true,
    bg: getComputedStyle(el).backgroundColor,
    htmlClass: document.documentElement.className,
  }
})
if (loader.present) {
  const l = luminance(parseRgb(loader.bg))
  console.log(`  遮罩背景 : ${loader.bg}  亮度 ${l.toFixed(3)}`)
  console.log(`  ${l > 0.6 ? '✓ 亮色下为浅色（无黑屏闪烁）' : '✗ 亮色下仍是深色，会闪一下'}`)
  await page.screenshot({ path: resolve(SHOTS, 'theme-light-loader.png') })
} else {
  console.log('  遮罩已消失（抓取时机偏晚，跳过）')
}

console.log('\n=== 5. 亮色下遍历页面 ===')
for (const path of PAGES) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(1100)
  const s = await sample()
  const l = luminance(parseRgb(s.bodyBg))
  console.log(`  ${path.padEnd(34)} 亮度=${l.toFixed(3)} ${ok(l > 0.6)}`)
  const name = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
  await page.screenshot({
    path: resolve(SHOTS, `theme-light-${name}.png`),
    fullPage: path === '/about',
  })
}

console.log('\n=== 6. 亮色下文章页正文元素抽查 ===')
await page.goto(`${BASE}/post/markdown-styling-reference`, {
  waitUntil: 'networkidle',
  timeout: 40000,
})
await page.waitForTimeout(1500)
const article = await page.evaluate(() => {
  const cs = (sel, prop) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el)[prop] : null
  }
  const paper = document.querySelector('.article-body')
  const paperBg = paper
    ? getComputedStyle(paper.closest('.glass-card') || paper).backgroundColor
    : null
  return {
    paperBg,
    body: cs('.article-body p', 'color'),
    h2: cs('.article-body h2', 'color'),
    link: cs('.article-body a', 'color'),
    code: cs('.article-body code', 'color'),
    codeBg: cs('.article-body code', 'backgroundColor'),
    pre: cs('.article-body pre', 'backgroundColor'),
    preCode: cs('.article-body pre code', 'color'),
    quote: cs('.article-body blockquote', 'color'),
    callout: cs('.article-body .callout p', 'color'),
    th: cs('.article-body th', 'color'),
    td: cs('.article-body td', 'color'),
    hljs: cs('.article-body .hljs', 'color'),
  }
})
for (const [k, v] of Object.entries(article)) console.log(`  ${k.padEnd(10)} ${v}`)
await page.screenshot({ path: resolve(SHOTS, 'theme-light-post.png') })

console.log('\n=== 7. 切回暗色 ===')
await page.click('.theme-toggle')
await page.waitForTimeout(900)
const back = await sample()
console.log(`  html.class : "${back.htmlClass}"  ${ok(!back.htmlClass.includes('light'))}`)
console.log(`  body 背景  : ${back.bodyBg}`)
console.log(`  storage    : ${await page.evaluate(() => localStorage.getItem('chibarie-theme'))}`)
await page.screenshot({ path: resolve(SHOTS, 'theme-dark-post.png') })

const srvErrors = errors.filter((e) => e.startsWith('HTTP'))
console.log(`\n控制台错误：${errors.length - srvErrors.length} 条，失败请求：${srvErrors.length} 条`)
for (const e of errors.slice(0, 8)) console.log(`  - ${e}`)

await browser.close()
