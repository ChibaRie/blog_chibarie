/**
 * 验证「首屏 → 向下滚动」的视觉衔接
 * 用法: node scripts/shot-scroll.mjs <url> <输出前缀>
 */
import { chromium } from 'playwright-core'

const SHOTS = 'D:/Code/my_projects/blog_chibarie/.workbuddy/shots'
const [url, prefix] = process.argv.slice(2)

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage()

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2200)

await page.screenshot({ path: `${SHOTS}/${prefix}-1-top.png` })

// 向左滚动一屏
await page.evaluate(() => window.scrollBy({ top: window.innerHeight, behavior: 'instant' }))
await page.waitForTimeout(1400)
await page.screenshot({ path: `${SHOTS}/${prefix}-2-scrolled.png` })

const info = await page.evaluate(() => {
  const hero = document.querySelector('section')
  return {
    heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
    viewport: window.innerHeight,
    scrollY: Math.round(window.scrollY),
  }
})

console.log(`Hero 高度 ${info.heroHeight}px / 视口 ${info.viewport}px`)
console.log(`滚动一屏后 scrollY = ${info.scrollY}px`)
console.log(`截图: ${prefix}-1-top.png, ${prefix}-2-scrolled.png`)

await browser.close()
