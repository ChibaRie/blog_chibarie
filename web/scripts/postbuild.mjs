/**
 * 构建后处理：
 * 1. 复制 index.html -> 404.html（SPA 深链兜底）
 * 2. 为已知路由生成静态 shell，让 /post/<slug> 在 GitHub Pages 返回 200 并带上标题/OG
 *
 * shell 只是 HTML 外壳，正文仍由 Vue 在浏览器里渲染；目的是状态码、标题和分享预览。
 */
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(ROOT, 'dist')

const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8')
const content = JSON.parse(readFileSync(join(ROOT, 'src/generated/index.json'), 'utf8'))
const site = content.site
const siteUrl = String(site.url || '').replace(/\/$/, '')
const siteName = site.name || 'chibarie'
const defaultDescription = site.description || ''

copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function shell({ title, description, path, image, type = 'website' }) {
  const fullTitle = `${title} · ${siteName}`
  const fullDescription = oneLine(description || defaultDescription)
  const canonical = `${siteUrl}${path}`
  const meta = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(fullDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ]
    .filter(Boolean)
    .join('\n    ')

  return indexHtml
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escapeHtml(fullDescription)}" />`,
    )
    .replace('</head>', `    ${meta}\n  </head>`)
}

function writeRoute(routePath, html) {
  const clean = routePath.replace(/^\/+|\/+$/g, '')
  if (!clean) return

  const dir = join(dist, clean)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)

  // 兼容 GitHub Pages 对 /path 的 clean URL 解析
  writeFileSync(join(dist, `${clean}.html`), html)
}

for (const post of content.posts) {
  const path = `/post/${post.slug}`
  writeRoute(
    path,
    shell({
      title: post.title,
      description: post.summary,
      path,
      image: post.cover ? new URL(post.cover, siteUrl).href : '',
      type: 'article',
    }),
  )
}

const staticRoutes = [
  ['/notes', '说说'],
  ['/archive', '归档'],
  ['/categories', '分类'],
  ['/tags', '标签'],
  ['/links', '友链'],
  ['/about', '关于'],
  ['/search', '搜索'],
]

for (const [path, title] of staticRoutes) {
  writeRoute(path, shell({ title, path }))
}

console.log(
  `[postbuild] 404.html + ${content.posts.length} post shells + ${staticRoutes.length} page shells`,
)
