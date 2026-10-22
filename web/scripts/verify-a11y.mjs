/**
 * 无障碍与交互验证：在真实浏览器里读取计算样式，而不是靠猜。
 */
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:5173'
const SHOTS = 'D:/Code/my_projects/blog_chibarie/.workbuddy/shots'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})

const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage()

// 1. 对比度与光标
await page.goto(`${BASE}/archive`, { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(800)

const styleChecks = await page.evaluate(() => {
  function parseRgb(value) {
    const m = value.match(/[\d.]+/g)
    return m ? m.slice(0, 3).map(Number) : null
  }
  function luminance([r, g, b]) {
    const chan = [r, g, b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2]
  }
  function contrast(fg, bg) {
    const l1 = luminance(parseRgb(fg))
    const l2 = luminance(parseRgb(bg))
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return ((hi + 0.05) / (lo + 0.05)).toFixed(2)
  }

  const mist600 = document.querySelector('.text-mist-600')
  const mist500 = document.querySelector('.text-mist-500')
  const btn = document.querySelector('button')
  const bg = getComputedStyle(document.body).backgroundColor

  return {
    mist600Color: mist600 ? getComputedStyle(mist600).color : '未找到',
    mist600Contrast: mist600
      ? contrast(getComputedStyle(mist600).color, 'rgb(13, 10, 26)')
      : '-',
    mist500Contrast: mist500
      ? contrast(getComputedStyle(mist500).color, 'rgb(13, 10, 26)')
      : '-',
    buttonCursor: btn ? getComputedStyle(btn).cursor : '未找到',
  }
})

console.log('=== 对比度与光标 ===')
console.log('mist-600 颜色:', styleChecks.mist600Color)
console.log('mist-600 对比度:', styleChecks.mist600Contrast, ': 1  (需 >= 4.5)')
console.log('mist-500 对比度:', styleChecks.mist500Contrast, ': 1')
console.log('button cursor:', styleChecks.buttonCursor, '(需为 pointer)')

// 2. 键盘焦点环
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1200)
for (let i = 0; i < 3; i++) await page.keyboard.press('Tab')
await page.waitForTimeout(300)

const focusInfo = await page.evaluate(() => {
  const el = document.activeElement
  if (!el) return null
  const s = getComputedStyle(el)
  return {
    tag: el.tagName,
    text: (el.textContent || '').trim().slice(0, 24),
    outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
  }
})
console.log('')
console.log('=== 键盘焦点 ===')
console.log(JSON.stringify(focusInfo, null, 2))
await page.screenshot({ path: `${SHOTS}/a11y-focus-ring.png` })

// 3. 卡片 hover 反馈
await page.hover('.glass-card-hover')
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/a11y-card-hover.png` })

const hoverState = await page.evaluate(() => {
  const card = document.querySelector('.glass-card-hover')
  if (!card) return '未找到'
  const s = getComputedStyle(card)
  return { transform: s.transform, borderColor: s.borderColor, shadow: s.boxShadow.slice(0, 40) }
})
console.log('')
console.log('=== 卡片 hover 状态 ===')
console.log(JSON.stringify(hoverState, null, 2))

await browser.close()
