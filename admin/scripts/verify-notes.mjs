import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../.workbuddy/shots')
mkdirSync(OUT_DIR, { recursive: true })

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const USERNAME = process.env.ADMIN_USER || 'admin'
const PASSWORD = process.env.ADMIN_PASS || 'admin123'

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
const page = await context.newPage()

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(msg.text())
})
page.on('pageerror', (err) => problems.push('pageerror: ' + err.message))

// 走真实登录流程
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 25000 })
await page.fill('input[placeholder="用户名"]', USERNAME)
await page.fill('input[placeholder="密码"]', PASSWORD)
await page.click('button:has-text("登录")')
await page.waitForURL(`${BASE}/`, { timeout: 15000 })
await page.waitForTimeout(1000)

console.log('\n== 侧边栏入口 ==')
const menuText = await page.locator('.el-menu').innerText()
check('侧边栏含「说说管理」', menuText.includes('说说管理'))

console.log('\n== 说说管理页 ==')
await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1200)

const appText = await page.locator('#app').innerText()
check('页面正常加载（非 404）', !/404|页面不存在/.test(appText))

const rowCount = await page.locator('.el-table__body tbody tr').count()
check('表格渲染出说说记录', rowCount > 0, `${rowCount} 行`)

const hasQuickBox = (await page.locator('textarea').count()) > 0
check('存在快速发布框', hasQuickBox)

await page.screenshot({ path: `${OUT_DIR}/admin-notes-list.png`, fullPage: true })

console.log('\n== 快速发布 -> 列表可见 -> 删除 ==')
const unique = '自动化验收 ' + Date.now().toString().slice(-6)
if (hasQuickBox) {
  await page.locator('textarea').first().fill(unique)
  // 精确定位发布按钮，排除表格行内的操作按钮
  const publishBtn = page.locator('button').filter({ hasText: /^发\s*布$/ }).first()
  if ((await publishBtn.count()) > 0) {
    await publishBtn.click()
  } else {
    await page.locator('button:has-text("发布说说"), button:has-text("发布")').first().click()
  }
  await page.waitForTimeout(1800)

  const newRow = page.locator('.el-table__body tbody tr', { hasText: unique })
  const hasNew = await newRow.count()
  check('发布后列表出现新记录', hasNew > 0)

  if (hasNew > 0) {
    const delBtn = newRow.first().locator('button:has-text("删除")').first()
    if ((await delBtn.count()) > 0) {
      await delBtn.click()
      await page.waitForTimeout(700)
      // 确认弹窗的确认按钮文案是「删除」，不是「确定」
      const box = page.locator('.el-message-box')
      const confirm = box.locator('.el-message-box__btns button.el-button--primary').first()
      const boxOpen = await box.isVisible().catch(() => false)
      check('删除有二次确认弹窗', boxOpen, boxOpen ? await box.locator('.el-message-box__title').innerText() : '')
      if (boxOpen) {
        check('确认弹窗提示连带删除评论', (await box.innerText()).includes('评论'))
        await confirm.click()
        await page.waitForTimeout(1800)
        const stillThere = await page.locator('.el-table__body tbody tr', { hasText: unique }).count()
        check('删除后记录消失', stillThere === 0)
      }
    } else {
      check('行内有删除按钮', false)
    }
  }
}

console.log('\n== 编辑弹窗 ==')
try {
  // 确保没有残留弹窗挡住点击
  const leftover = page.locator('.el-message-box__headerbtn')
  if (await leftover.isVisible().catch(() => false)) {
    await leftover.click()
    await page.waitForTimeout(500)
  }
  // 优先挑一条带图的说说来验图片管理（不带图的行 img 数本来就是 0）
  const withImg = page.locator('.el-table__body tbody tr').filter({ has: page.locator('img') })
  const targetRow = (await withImg.count()) > 0
    ? withImg.first()
    : page.locator('.el-table__body tbody tr').first()

  const editBtn = targetRow.locator('button:has-text("编辑")').first()
  if ((await editBtn.count()) > 0) {
    await editBtn.click()
    await page.waitForTimeout(1200)
    const dialog = page.locator('.el-dialog')
    const dialogVisible = await dialog.isVisible().catch(() => false)
    check('编辑弹窗打开', dialogVisible)

    if (dialogVisible) {
      check('弹窗内有内容编辑框', (await dialog.locator('textarea').count()) > 0)
      check('弹窗内有发布时间选择器', (await dialog.locator('.el-date-editor').count()) > 0)
      check('弹窗内有状态选择', (await dialog.locator('.el-radio-group').count()) > 0)

      const addBtn = await dialog.locator('button:has-text("添加图片")').count()
      const imgs = await dialog.locator('img').count()
      const reorder = await dialog.locator('button:has-text("→")').count()
      const removeBtn = await dialog.locator('button:has-text("×")').count()
      check('编辑弹窗可添加图片', addBtn > 0, `添加图片按钮 ${addBtn}`)
      check('已有图片正常回显', imgs > 0, `${imgs} 张`)
      check('图片可调序 / 删除', reorder > 0 && removeBtn > 0, `调序 ${reorder} / 删除 ${removeBtn}`)

      await page.screenshot({ path: `${OUT_DIR}/admin-notes-edit.png` })
      await page.locator('.el-dialog__headerbtn').first().click()
      await page.waitForTimeout(600)
    }
  } else {
    check('存在编辑按钮', false)
  }
} catch (err) {
  check('编辑弹窗流程', false, err.message.split('\n')[0])
  await page.screenshot({ path: `${OUT_DIR}/admin-notes-edit-fail.png` })
}

console.log('\n== 评论管理来源筛选 ==')
try {
  await page.goto(`${BASE}/comments`, { waitUntil: 'networkidle', timeout: 25000 })
  await page.waitForTimeout(1200)
  const commentsText = await page.locator('#app').innerText()
  check('评论管理含「说说评论」筛选', commentsText.includes('说说评论'))
  await page.screenshot({ path: `${OUT_DIR}/admin-comments.png`, fullPage: true })
} catch (err) {
  check('评论管理页', false, err.message.split('\n')[0])
}

console.log('\n== 控制台 ==')
const realErrors = problems.filter((e) => !/favicon|ResizeObserver|DevTools/i.test(e))
check('无控制台错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()

const passed = results.filter((r) => r.ok).length
console.log(`\n结果：${passed} 通过 / ${results.length - passed} 失败`)
console.log(`截图目录：${OUT_DIR}`)
process.exit(passed === results.length ? 0 : 1)
