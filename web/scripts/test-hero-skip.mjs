/**
 * 验证首页「滚轮向下自动跳过头图」
 */
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage()

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2200)

const heroHeight = await page.evaluate(() =>
  Math.round(document.querySelector('section').getBoundingClientRect().height),
)

await page.mouse.move(720, 450)

// 1) 在头图区域向下滚一点，应被直接跳过整个头图
await page.mouse.wheel(0, 120)
await page.waitForTimeout(1300)
const afterSkip = await page.evaluate(() => Math.round(window.scrollY))

// 2) 已经在文章区，继续向下滚应正常滚动，不被拦截
await page.mouse.wheel(0, 500)
await page.waitForTimeout(900)
const afterFeed = await page.evaluate(() => Math.round(window.scrollY))

// 3) 回到顶部再滚，应再次跳过头图
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(700)
await page.mouse.wheel(0, 100)
await page.waitForTimeout(1300)
const secondSkip = await page.evaluate(() => Math.round(window.scrollY))

// 4) 向上滚不应被拦截
await page.mouse.wheel(0, -200)
await page.waitForTimeout(900)
const afterUp = await page.evaluate(() => Math.round(window.scrollY))

console.log(`Hero 高度: ${heroHeight}px (视口 900px)`)
console.log('')
console.log(`1. 头图处向下滚一次  → scrollY = ${afterSkip}  ${Math.abs(afterSkip - heroHeight) < 20 ? '✓ 已跳过头图' : '✗ 未跳过'}`)
console.log(`2. 文章区继续向下滚  → scrollY = ${afterFeed}  ${afterFeed > afterSkip ? '✓ 正常滚动' : '✗ 被拦截'}`)
console.log(`3. 回顶部后再向下滚  → scrollY = ${secondSkip}  ${Math.abs(secondSkip - heroHeight) < 20 ? '✓ 再次跳过' : '✗ 未跳过'}`)
console.log(`4. 向上滚            → scrollY = ${afterUp}  ${afterUp < secondSkip ? '✓ 正常上滚' : '✗ 被拦截'}`)

await browser.close()
