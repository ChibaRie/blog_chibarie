import { chromium } from 'playwright-core'

const base = (process.argv[2] || 'http://127.0.0.1:4177/blog_chibarie').replace(/\/$/, '')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const failures = [], checks = []
page.on('pageerror', error => failures.push(error.message))
page.on('requestfailed', request => failures.push(request.url()))
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
const open = async route => {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !document.querySelector('.loader-star'))
}
const loaded = async () => {
  await page.getByRole('dialog', { name: '图片预览' }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const image = document.querySelector('.image-viewer-image')
    return image?.complete && image.naturalWidth > 0 && !image.classList.contains('image-viewer-image-hidden')
  })
}
const closed = async () => {
  await page.getByRole('dialog', { name: '图片预览' }).waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden')
}

try {
  await open('/notes')
  const first = page.locator('.note-gallery button').first()
  const src = await first.locator('img').getAttribute('src')
  const pageCount = context.pages().length
  await first.click(); await loaded()
  check((await page.locator('.image-viewer-image').getAttribute('src')) === src, 'Note image opens inside the page')
  check(await page.locator('.image-viewer-count').innerText() === '1 / 3', 'Note gallery preserves image grouping')
  check(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'Background scrolling is locked')
  check(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '关闭图片预览'), 'Dialog starts with close button focused')
  await page.getByRole('button', { name: '下一张图片', exact: true }).click(); await loaded()
  check(await page.locator('.image-viewer-count').innerText() === '2 / 3', 'Next image button works')
  await page.keyboard.press('ArrowLeft'); await loaded()
  check(await page.locator('.image-viewer-count').innerText() === '1 / 3', 'Arrow keys switch images')
  await page.keyboard.press('ArrowLeft')
  check(await page.locator('.image-viewer-count').innerText() === '1 / 3', 'Navigation stays within gallery bounds')
  await page.keyboard.press('Tab')
  if (!await page.evaluate(() => document.hasFocus())) await page.keyboard.press('Tab')
  check(await page.evaluate(() => document.querySelector('.image-viewer').contains(document.activeElement)), 'Keyboard focus stays inside the dialog')
  await page.keyboard.press('Escape'); await closed()
  check(await first.evaluate(el => el === document.activeElement), 'Closing restores focus to the source image')
  await first.press('Enter'); await loaded()
  await page.locator('.image-viewer-stage').click({ position: { x: 5, y: 5 } }); await closed()
  check(context.pages().length === pageCount && page.url() === `${base}/notes`, 'No new tab or image navigation')
  const single = page.locator('.note-gallery > button:only-child').first()
  if (await single.count()) {
    await single.click(); await loaded()
    check(await page.locator('.image-viewer-count').innerText() === '1 / 1' && await page.getByRole('button', { name: '下一张图片', exact: true }).count() === 0, 'Single-image note hides gallery navigation')
    await page.getByRole('button', { name: '关闭图片预览', exact: true }).click(); await closed()
  }

  const imageURL = await first.locator('img').evaluate(el => el.currentSrc || el.src)
  await page.route(imageURL, route => route.fulfill({ status: 200, headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }, body: 'invalid image' }))
  await first.click()
  await page.locator('.image-viewer-error').waitFor({ state: 'visible' })
  await page.keyboard.press('Escape'); await closed()
  await page.unroute(imageURL)
  await first.click(); await loaded()
  check(await page.locator('.image-viewer-error').count() === 0, 'Reopening a failed image clears the stale error')
  await page.keyboard.press('Escape'); await closed()

  await open('/post/agentcraft-project')
  const articleImage = page.locator('.article-body img').first()
  await articleImage.waitFor()
  await articleImage.press('Enter'); await loaded()
  check(await page.locator('.image-viewer-image').getAttribute('src') === await articleImage.evaluate(el => el.currentSrc || el.src), 'Article image supports keyboard preview')
  await page.keyboard.press('Escape'); await closed()
  check(await articleImage.evaluate(el => el === document.activeElement), 'Article preview restores image focus')
  await articleImage.click(); await loaded()
  await page.keyboard.press('Escape'); await closed()
  check(context.pages().length === pageCount, 'Article images also stay in the same tab')

  await page.setViewportSize({ width: 375, height: 812 })
  await open('/notes')
  await page.locator('.note-gallery button').first().click(); await loaded()
  const bounds = await page.locator('.image-viewer-image').boundingBox()
  check(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 375 && bounds.y + bounds.height <= 812, 'Mobile image fits the viewport')
  check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Mobile preview has no horizontal overflow')
  await page.getByRole('button', { name: '关闭图片预览', exact: true }).click(); await closed()
  check(failures.length === 0, 'No browser errors or broken image requests')
  console.log(JSON.stringify({ checks, failures }, null, 2))
} finally { await browser.close() }
