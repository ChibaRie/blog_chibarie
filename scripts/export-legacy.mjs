/**
 * 一次性迁移脚本：把旧 SQLite 博客导出成 content/ 下的 Markdown。
 *
 * 只导出已发布文章到 content/posts；草稿写到 content/drafts（已 gitignore），
 * 避免把个人草稿带进公开仓库。
 *
 * 用法：node scripts/export-legacy.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = join(ROOT, 'server/data/blog.db')
const CONTENT_DIR = join(ROOT, 'content')
const POSTS_DIR = join(CONTENT_DIR, 'posts')
const DRAFTS_DIR = join(CONTENT_DIR, 'drafts')
const NOTES_DIR = join(CONTENT_DIR, 'notes')
const PUBLIC_UPLOADS = join(ROOT, 'web/public/uploads')

if (!existsSync(DB_PATH)) {
  console.error(`找不到旧数据库：${DB_PATH}`)
  process.exit(1)
}

const db = new DatabaseSync(DB_PATH)

function rows(sql, ...params) {
  return db.prepare(sql).all(...params)
}

function mkdir(path) {
  mkdirSync(path, { recursive: true })
}

function yaml(value) {
  return JSON.stringify(String(value ?? ''))
}

function frontmatter(data) {
  const lines = ['---']
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${yaml(value)}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}

function isoDate(input) {
  if (!input) return ''
  let value = String(input).trim().replace(' ', 'T')
  // .NET 的 7 位小数在 JS 里不好解析，统一截到毫秒
  value = value.replace(/(\.\d{3})\d+/, '$1')
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) value += '+08:00'
  return value
}

function safeName(input) {
  return String(input || 'untitled')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120)
}

function stripLeadingH1(source) {
  return String(source || '')
    .replace(/\r\n/g, '\n')
    .replace(/^\s*#\s+[^\n]*\n+/, '')
    .trimStart()
}

function plainSummary(source, title) {
  const text = stripLeadingH1(source)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return title
  return text.slice(0, 120)
}

function readSettings() {
  const map = {}
  for (const row of rows('SELECT key, value FROM settings')) {
    map[row.key] = row.value ?? ''
  }
  return map
}

function parseJsonArray(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function setting(settings, key, fallback = '') {
  const value = settings[key]
  return value && value.trim() ? value : fallback
}

const settings = readSettings()

function readExistingSite() {
  const file = join(CONTENT_DIR, 'site.json')
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

const existingSite = readExistingSite()

const categories = rows(
  'SELECT id, name, slug, description, sort FROM categories ORDER BY sort ASC, id ASC',
)

const posts = rows(`
  SELECT p.*, c.slug AS category_slug
  FROM posts p
  LEFT JOIN categories c ON c.id = p.category_id
  ORDER BY p.id ASC
`)

const notes = rows('SELECT * FROM notes ORDER BY id ASC')
const links = rows('SELECT * FROM friend_links ORDER BY sort ASC, id ASC')
const tags = rows('SELECT id, name FROM tags ORDER BY id ASC')

const assetRefs = new Set()

function collectAssets(text) {
  const source = String(text || '')
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    assetRefs.add(match[1])
  }
  for (const match of source.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    assetRefs.add(match[1])
  }
}

mkdir(POSTS_DIR)
mkdir(DRAFTS_DIR)
mkdir(NOTES_DIR)

for (const post of posts) {
  const published = post.status === 'published'
  const body = stripLeadingH1(post.content)
  const postTags = rows(
    `SELECT t.name FROM post_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id = ?
     ORDER BY t.id ASC`,
    post.id,
  ).map((row) => row.name)

  const data = {
    id: post.id,
    title: post.title,
    slug: post.slug || `post-${post.id}`,
    date: isoDate(post.published_at || post.created_at),
    updated: isoDate(post.updated_at || post.created_at),
    summary: post.summary || plainSummary(post.content, post.title),
    cover: post.cover || '',
    category: post.category_slug || '',
    tags: postTags,
    isTop: Boolean(post.is_top),
    draft: !published,
  }

  const file = join(
    published ? POSTS_DIR : DRAFTS_DIR,
    `${safeName(data.slug)}-${post.id}.md`,
  )
  writeFileSync(file, frontmatter(data) + body, 'utf8')

  if (published) {
    if (post.cover) assetRefs.add(post.cover)
    collectAssets(post.content)
  }

  console.log(`${published ? 'POST ' : 'DRAFT'} #${post.id} ${post.title}`)
}

for (const note of notes) {
  const date = isoDate(note.published_at || note.created_at)
  const images = parseJsonArray(note.images)
  const data = {
    id: note.id,
    date,
    images,
    likes: note.likes || 0,
    draft: note.status !== 'published',
  }

  const file = join(NOTES_DIR, `${date.slice(0, 10)}-${note.id}.md`)
  writeFileSync(file, frontmatter(data) + String(note.content || ''), 'utf8')

  for (const image of images) assetRefs.add(image)
  console.log(`NOTE  #${note.id}`)
}

const heroBackgrounds = (() => {
  const multi = parseJsonArray(settings['site.heroBackgrounds'])
  if (multi.length) return multi
  const single = setting(
    settings,
    'site.heroBackground',
    setting(settings, 'site.background', ''),
  )
  return single ? [single] : []
})()

const legacyBackground = setting(settings, 'site.background', '')

const site = {
  url: 'https://chibarie.github.io/blog_chibarie',
  name: setting(settings, 'site.name', 'chibarie'),
  description: setting(settings, 'site.description', '记录技术与生活'),
  keywords: setting(settings, 'site.keywords', ''),
  icp: setting(settings, 'site.icp', ''),
  avatar: settings['site.avatar'] || '',
  heroBackgrounds,
  pageBackground: setting(
    settings,
    'site.pageBackground',
    setting(settings, 'site.heroBackground', legacyBackground),
  ),
  socials: {
    bilibili: settings['site.bilibili'] || '',
    github: settings['site.github'] || '',
    steam: settings['site.steam'] || '',
    location: settings['site.location'] || '',
  },
  giscus: existingSite.giscus || {
    repo: 'ChibaRie/blog_chibarie',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname',
    lang: 'zh-CN',
  },
}

writeFileSync(
  join(CONTENT_DIR, 'site.json'),
  JSON.stringify(site, null, 2) + '\n',
  'utf8',
)

const about = setting(settings, 'site.aboutContent', '')
writeFileSync(join(CONTENT_DIR, 'about.md'), about, 'utf8')
collectAssets(about)

writeFileSync(
  join(CONTENT_DIR, 'tags.json'),
  JSON.stringify(
    tags.map(({ name, slug }) => ({ name, slug })),
    null,
    2,
  ) + '\n',
  'utf8',
)

writeFileSync(
  join(CONTENT_DIR, 'categories.json'),
  JSON.stringify(
    categories.map(({ name, slug, description, sort }) => ({
      name,
      slug,
      description,
      sort,
    })),
    null,
    2,
  ) + '\n',
  'utf8',
)

writeFileSync(
  join(CONTENT_DIR, 'links.json'),
  JSON.stringify(
    links.map(({ name, url, avatar, description, sort }) => ({
      name,
      url,
      avatar,
      description,
      sort,
    })),
    null,
    2,
  ) + '\n',
  'utf8',
)

for (const link of links) {
  if (link.avatar) assetRefs.add(link.avatar)
}

for (const ref of [site.avatar, site.pageBackground, ...site.heroBackgrounds]) {
  if (ref) assetRefs.add(ref)
}

let copied = 0
let missing = 0
for (const ref of assetRefs) {
  if (!ref.startsWith('/uploads/')) continue
  const source = join(ROOT, 'server', ref)
  if (!existsSync(source)) {
    console.warn(`MISS  ${ref}`)
    missing += 1
    continue
  }
  const target = join(PUBLIC_UPLOADS, ref.replace(/^\/uploads\//, ''))
  mkdir(dirname(target))
  copyFileSync(source, target)
  copied += 1
}

console.log(
  `\n完成：文章 ${posts.filter((p) => p.status === 'published').length} 篇，` +
    `草稿 ${posts.filter((p) => p.status !== 'published').length} 篇，` +
    `说说 ${notes.length} 条，复制图片 ${copied} 个，缺失 ${missing} 个。`,
)

db.close()
