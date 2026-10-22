import { chromium } from 'playwright-core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const full = args.includes('--full')
const [target, out] = args.filter((a) => a !== '--full')

// 境外站点需要走环境代理，localhost 直连
const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  ...(proxyServer
    ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1,*.local' } }
    : {}),
})

const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 1050 } })
).newPage()

await page.goto(target, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: resolve(__dirname, out), fullPage: full })
await browser.close()
console.log('OK', target, '→', out)
