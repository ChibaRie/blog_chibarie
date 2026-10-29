/** Browser acceptance for the appearance panel and expandable notes. */
import { chromium } from 'playwright-core'

const base = (process.argv[2] || 'http://localhost:4177/blog_chibarie').replace(/\/$/, '')
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const failures = []
const checks = []
page.on('pageerror', error => failures.push(error.message))
page.on('requestfailed', request => failures.push(request.url()))
page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
page.on('request', request => {
  const path = new URL(request.url()).pathname
  if (/\/(?:api|__prototype|\.workbuddy)\//.test(path)) failures.push(`Unexpected request: ${path}`)
})
const check = (value, label) => { if (!value) throw new Error(label); checks.push(label) }
const open = async route => {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !document.querySelector('.loader-star'))
}
const css = (selector, property) => page.locator(selector).first().evaluate((el, property) => getComputedStyle(el).getPropertyValue(property), property)
const settle = card => card.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))) })
const setRange = (name, value) => page.getByRole('slider', { name, exact: true }).evaluate((el, value) => {
  el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }))
}, String(value))
const waitCss = (selector, property, value) => page.waitForFunction(({ selector, property, value }) => {
  const actual = getComputedStyle(document.querySelector(selector)).getPropertyValue(property)
  return property === 'opacity' ? actual === value : actual.endsWith(value)
}, { selector, property, value })

try {
  await open('/notes')
  await page.waitForSelector('[data-testid=note-item]')
  const text = await page.locator('main').innerText()
  check(!text.includes('随手记的日常') && !/共\s*\d+\s*条/.test(text), 'Notes introduction and total removed')
  check(await page.locator('[data-testid=note-item]').evaluateAll(cards => cards.every(card => card.getBoundingClientRect().width === 880)), 'Uniform compact notes')
  const first = page.getByTestId('note-item').first()
  check(await first.locator('.note-gallery img').evaluateAll(images => images.every(image => image.getBoundingClientRect().height <= 168)), 'Compact image thumbnails')
  await first.getByRole('button', { name: '展开说说', exact: false }).click()
  check(await first.evaluate(el => el.getAnimations().some(animation => animation.playState === 'running')), 'Note size animation starts')
  await settle(first)
  check((await first.boundingBox()).width === 1312, 'Note expands to full page frame')
  await first.getByRole('button', { name: '收起说说', exact: false }).click()
  await settle(first)
  check((await first.boundingBox()).width === 880, 'Note collapses back')

  await page.getByRole('button', { name: '打开外观设置', exact: true }).click()
  check(await page.getByRole('slider', { name: '页脚', exact: true }).inputValue() === '0', 'Footer defaults to 0%')
  check(await page.getByRole('slider', { name: '滚动后的导航栏', exact: true }).inputValue() === '25', 'Scrolled navigation defaults to 25%')
  await setRange('卡片圆角', 0)
  await setRange('描边粗细', 2)
  await setRange('内容卡片', 55)
  await waitCss('[data-testid=note-item]', 'background-color', '0.55)')
  check(await css('[data-testid=note-item]', 'border-radius') === '0px' && await css('[data-testid=note-item]', 'border-top-width') === '2px', 'Card radius and borders update')
  await page.getByRole('switch', { name: '显示花瓣与星点', exact: true }).uncheck()
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#app canvas'), ctx = canvas.getContext('2d')
    return [...ctx.getImageData(0, 0, canvas.width, canvas.height).data].every(value => value === 0)
  })
  check(await css('#app canvas', 'visibility') === 'hidden', 'Disabling particles clears the canvas')
  await page.getByRole('switch', { name: '显示花瓣与星点', exact: true }).check()
  await setRange('粒子浓淡', 35)
  await waitCss('#app canvas', 'opacity', '0.35')
  await page.getByRole('button', { name: '晴蓝主题色', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.reload({ waitUntil: 'networkidle' })
  check(await css('[data-testid=note-item]', 'border-radius') === '0px' && await css('#app canvas', 'opacity') === '0.35', 'Appearance persists after reload')
  await page.getByRole('button', { name: '打开外观设置', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  await waitCss('#app canvas', 'opacity', '1')
  check(await css('[data-testid=note-item]', 'border-radius') === '15px', 'Reset restores defaults')
  await page.keyboard.press('Escape')

  const routes = ['/notes', '/about', '/archive', '/categories', '/tags', '/links', '/search', '/post/python-asyncio-fastapi-notes']
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.getByRole('button', { name: '切换到日间模式', exact: true }).click()
      await page.waitForFunction(() => document.documentElement.classList.contains('light'))
    }
    const readings = []
    for (const route of routes) {
      await open(route)
      readings.push(await page.evaluate(() => {
        const style = selector => getComputedStyle(document.querySelector(selector))
        return [style('.backdrop-veil').backgroundColor, style('.backdrop-fade').backgroundImage, style('.backdrop-image').filter]
      }))
    }
    check(readings.every(reading => JSON.stringify(reading) === JSON.stringify(readings[0])), `${theme}: shared background across all content pages`)
  }
  await open('/notes')
  for (const width of [1920, 1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `${width}px: no horizontal overflow`)
  }
  await page.getByRole('button', { name: '打开外观设置', exact: true }).click()
  const panel = await page.locator('#appearance-panel').boundingBox()
  check(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= 375 && panel.y + panel.height <= 900, 'Mobile settings fit inside viewport')
  await page.keyboard.press('Escape')
  await page.getByTestId('note-item').first().getByRole('button', { name: '展开说说', exact: false }).click()
  await settle(page.getByTestId('note-item').first())
  check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Mobile expanded notes fit viewport')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByTestId('note-item').first().getByRole('button', { name: '收起说说', exact: false }).click()
  check(await page.getByTestId('note-item').first().evaluate(el => el.getAnimations().length) === 0, 'Reduced motion skips note animation')
  check(await page.evaluate(() => document.fonts.check('16px Outfit')), 'Local Outfit font loaded')
  check(failures.length === 0, 'No browser errors, broken requests or backend calls')
  console.log(JSON.stringify({ checks, failures }, null, 2))
} finally { await browser.close() }
