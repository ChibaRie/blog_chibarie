/**
 * 验证「后台修改文章发布日期」功能。
 *
 * 覆盖两条路径：
 *   A. 列表页——直接点日期改（走后端 PUT，需验证不会误伤正文/标签）
 *   B. 编辑器——「发布日期」字段改完保存
 *
 * 每步都对比改动前后的完整字段快照，最后自动恢复原值。
 * 用法：node scripts/test-post-date.mjs [postId]
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(__dirname, '../../.workbuddy/shots')
mkdirSync(SHOTS, { recursive: true })

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const API = `${BASE}/api`
const USERNAME = process.env.ADMIN_USER || 'admin'
const PASSWORD = process.env.ADMIN_PASS || 'admin123'
const POST_ID = Number(process.argv[2] || 22)

const ok = (b) => (b ? '✓' : '✗')
let failures = 0
function check(label, pass, detail = '') {
  if (!pass) failures++
  console.log(`  ${ok(pass)} ${label}${detail ? `  ${detail}` : ''}`)
}

// ---------- API 辅助 ----------
let token = ''

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || (body && body.code !== 0)) {
    throw new Error(`${init.method || 'GET'} ${path} 失败: ${body?.message || res.status}`)
  }
  return body.data
}

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  const body = await res.json()
  token = body.data.token
}

/** 把文章映射回 PUT 需要的 payload */
function toPayload(p, publishedAt) {
  return {
    title: p.title,
    slug: p.slug,
    summary: p.summary,
    content: p.content,
    cover: p.cover,
    status: p.status,
    categoryId: p.categoryId,
    tagIds: (p.tags ?? []).map((t) => t.id),
    isTop: p.isTop,
    publishedAt: publishedAt ?? undefined,
  }
}

const datePart = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : null) // sv-SE 即 YYYY-MM-DD
const timePart = (s) => {
  if (!s) return null
  const d = new Date(s)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

await login()
console.log(`=== 0. 准备：读取文章 #${POST_ID} 的原始状态 ===`)
const original = await api(`/admin/posts/${POST_ID}`)
console.log(`  标题        : ${original.title.slice(0, 30)}`)
console.log(`  原始发布日期: ${original.publishedAt}`)
console.log(`  标签数      : ${(original.tags ?? []).length}`)
console.log(`  正文字数    : ${original.content.length}`)
console.log(`  状态        : ${original.status} | 分类 ${original.categoryId} | 置顶 ${original.isTop}`)
console.log(`  封面        : ${original.cover || '(空)'}`)

if (!original.publishedAt) {
  console.log('\n该文章没有发布日期，先补一个再测。')
  await api(`/admin/posts/${POST_ID}`, {
    method: 'PUT',
    body: JSON.stringify(toPayload(original, new Date().toISOString())),
  })
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
// 失败的网络请求一定要连 URL 一起记下来，否则只看到 ERR_CONNECTION_CLOSED 无法定位
const failedRequests = []
page.on('requestfailed', (r) => {
  failedRequests.push(`${r.failure()?.errorText ?? 'failed'}  ${r.url()}`)
})

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
await page.fill('input[placeholder="用户名"]', USERNAME)
await page.fill('input[placeholder="密码"]', PASSWORD)
await page.click('button:has-text("登录")')
await page.waitForURL(`${BASE}/`, { timeout: 20000 })

// ---------- A. 列表页改日期 ----------
console.log('\n=== A. 列表页直接改日期 ===')
await page.goto(`${BASE}/posts`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)

const pickers = await page.locator('.date-cell-picker').count()
check('列表每行都有日期选择器', pickers > 0, `共 ${pickers} 个`)

// 用关键词把目标文章过滤出来（列表有分页，不一定在第一页）
const keyword = original.title.slice(0, 8)
const searchInput = page.locator('input[placeholder="搜标题 / 摘要 / 正文"]')
await searchInput.fill(keyword)
await searchInput.press('Enter')
await page.waitForTimeout(2000)

const rowCount = await page.locator('tbody tr').count()
console.log(`  关键词「${keyword}」筛出 ${rowCount} 行`)
check('列表有可编辑的行', rowCount > 0, `实际 ${rowCount} 行`)

const row = page.locator('tbody tr').first()
const rowPicker = row.locator('.date-cell-picker input')
const shownBefore = await rowPicker.inputValue()
console.log(`  第 ${POST_ID} 行显示的日期：${shownBefore}`)
check(
  '显示值与接口一致',
  shownBefore === datePart(original.publishedAt),
  `期望 ${datePart(original.publishedAt)}`,
)

await page.screenshot({ path: resolve(SHOTS, 'date-list.png') })

// 改成一个明确的历史日期
const NEW_DATE = '2026-03-05'
await rowPicker.click()
await rowPicker.fill(NEW_DATE)
await rowPicker.press('Enter')
await page.waitForTimeout(2500)

let afterList = await api(`/admin/posts/${POST_ID}`)
console.log(`  改后 publishedAt：${afterList.publishedAt}`)
check('日期已改为目标值', datePart(afterList.publishedAt) === NEW_DATE, `实际 ${datePart(afterList.publishedAt)}`)
check(
  '时分秒保留（没被重置成 00:00）',
  timePart(afterList.publishedAt) === timePart(original.publishedAt),
  `${timePart(original.publishedAt)} → ${timePart(afterList.publishedAt)}`,
)
check('正文未被清空', afterList.content.length === original.content.length, `${original.content.length} → ${afterList.content.length}`)
check('标签未被清空', (afterList.tags ?? []).length === (original.tags ?? []).length, `${(original.tags ?? []).length} → ${(afterList.tags ?? []).length}`)
check('标题未变', afterList.title === original.title)
check('分类未变', afterList.categoryId === original.categoryId)
check('置顶未变', afterList.isTop === original.isTop)
check('封面未变', afterList.cover === original.cover)
check('状态未变', afterList.status === original.status)

// ---------- B. 编辑器改日期 ----------
console.log('\n=== B. 编辑器「发布日期」字段 ===')
await page.goto(`${BASE}/posts/${POST_ID}/edit`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1800)

const dateItem = page.locator('.el-form-item', { hasText: '发布日期' }).first()
const editorDateInput = dateItem.locator('input').first()
const editorShown = await editorDateInput.inputValue()
console.log(`  编辑器回填值：${editorShown}`)
check(
  '编辑器回填了当前日期',
  editorShown.startsWith(NEW_DATE),
  `期望以 ${NEW_DATE} 开头`,
)
// 发布日期在侧边栏靠下，截图前先滚到可视区
await dateItem.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(SHOTS, 'date-editor.png') })

const EDIT_DATE = '2026-01-20'
await editorDateInput.click()
await editorDateInput.fill(`${EDIT_DATE} 09:30`)
await editorDateInput.press('Enter')
await page.waitForTimeout(600)
// 保存（点侧边栏的保存草稿按钮，避免改变发布状态）
const saveBtn = page.locator('button:has-text("保存草稿")').first()
if (await saveBtn.count()) {
  await saveBtn.click()
} else {
  await page.locator('button:has-text("发布")').first().click()
}
await page.waitForTimeout(3000)

const afterEditor = await api(`/admin/posts/${POST_ID}`)
console.log(`  保存后 publishedAt：${afterEditor.publishedAt}`)
check('编辑器改的日期已保存', datePart(afterEditor.publishedAt) === EDIT_DATE, `实际 ${datePart(afterEditor.publishedAt)}`)
check('时间部分为 09:30', timePart(afterEditor.publishedAt)?.startsWith('09:30'), `实际 ${timePart(afterEditor.publishedAt)}`)
check('正文仍完整', afterEditor.content.length === original.content.length)
check('标签仍完整', (afterEditor.tags ?? []).length === (original.tags ?? []).length)
check('状态未被改动', afterEditor.status === original.status, `${original.status} → ${afterEditor.status}`)

// ---------- 恢复 ----------
console.log('\n=== C. 恢复原始发布日期 ===')
await api(`/admin/posts/${POST_ID}`, {
  method: 'PUT',
  body: JSON.stringify(toPayload(afterEditor, original.publishedAt)),
})
const restored = await api(`/admin/posts/${POST_ID}`)
check('已恢复原值', restored.publishedAt === original.publishedAt, `${restored.publishedAt}`)
check('恢复后正文仍完整', restored.content.length === original.content.length)
check('恢复后标签仍完整', (restored.tags ?? []).length === (original.tags ?? []).length)

console.log(`\n控制台错误：${errors.length} 条`)
for (const e of [...new Set(errors)].slice(0, 6)) console.log(`  - ${e}`)

console.log(`失败请求：${failedRequests.length} 条`)
for (const r of [...new Set(failedRequests)].slice(0, 10)) console.log(`  - ${r}`)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
