/**
 * 构建时内容生成器。
 *
 * content/*.md + *.json  ->  web/src/generated/*.json
 *
 * 生成结果被前端静态 API 层直接 import；GitHub Actions 在构建前执行，
 * 本地 dev 由 vite 插件监听 content/ 自动重跑。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import type {
  ArchiveItem,
  Category,
  FriendLink,
  Note,
  Post,
  SiteInfo,
  Tag,
  TocItem,
} from '../src/api/types'
import { renderMarkdown } from './markdown'

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = resolve(WEB_ROOT, '..')
const CONTENT_DIR = join(ROOT, 'content')
const OUT_DIR = join(WEB_ROOT, 'src/generated')
const POSTS_OUT = join(OUT_DIR, 'posts')
const PUBLIC_DATA = join(WEB_ROOT, 'public/data')

interface PostMeta {
  id?: number | string
  title: string
  slug?: string
  date: string
  updated?: string
  summary?: string
  cover?: string
  category?: string
  tags?: string[]
  isTop?: boolean
  draft?: boolean
}

interface NoteMeta {
  id?: number | string
  date: string
  images?: string[]
  draft?: boolean
}

interface PostDetail {
  contentHtml: string
  toc: TocItem[]
}

interface SearchItem {
  slug: string
  title: string
  summary: string
  tags: string[]
  text: string
}

function normalizeBase(input: string): string {
  const value = (input || '/').trim()
  if (value === '/') return '/'
  return `/${value.replace(/^\/+|\/+$/g, '')}/`
}

function withBase(path: string, base: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path
  return base === '/' ? path : base.slice(0, -1) + path
}

function withBaseHtml(html: string, base: string): string {
  if (!html || base === '/') return html
  return html
    .replace(/((?:src|href|poster)=["'])\/(?!\/)/g, `$1${base}`)
    .replace(/(url\(["']?)\/(?!\/)/g, `$1${base}`)
}

function isoDate(input: string): string {
  if (!input) return ''
  let value = String(input).trim().replace(' ', 'T')
  value = value.replace(/(\.\d{3})\d+/, '$1')
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) value += '+08:00'
  return value
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

function readMarkdownDir(dir: string): { file: string; body: string; data: Record<string, unknown> }[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const file = join(dir, name)
      const parsed = matter(readFileSync(file, 'utf8'))
      return { file, body: parsed.content, data: parsed.data as Record<string, unknown> }
    })
}

function stripMarkdown(source: string): string {
  return String(source || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/[*_`~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveSummary(source: string): string {
  const text = stripMarkdown(source)
  return text.slice(0, 120)
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function slugifyTag(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}+#._-]/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || name
}

function slugOf(data: Record<string, unknown>, file: string): string {
  const slug = String(data.slug || '').trim()
  if (slug) return slug
  return basename(file, '.md').replace(/-\d+$/, '')
}

function postFrom(
  file: string,
  body: string,
  data: Record<string, unknown>,
  categories: Category[],
  tagsByName: Map<string, Tag>,
  base: string,
): { post: Post; detail: PostDetail; search: SearchItem } {
  const title = String(data.title || basename(file, '.md'))
  const slug = slugOf(data, file)
  const id = Number(data.id) || hashString(slug)
  const category = categories.find((item) => item.slug === String(data.category || ''))
  const tagNames = Array.isArray(data.tags) ? data.tags.map(String) : []
  const postTags = tagNames
    .map((name) => tagsByName.get(name))
    .filter((tag): tag is Tag => Boolean(tag))

  const rendered = renderMarkdown(body)
  const summary = String(data.summary || '').trim() || deriveSummary(body)
  const date = isoDate(String(data.date || ''))
  const updated = isoDate(String(data.updated || data.date || ''))

  const post: Post = {
    id,
    title,
    slug,
    summary,
    content: '',
    contentHtml: '',
    cover: withBase(String(data.cover || ''), base),
    status: 'published',
    categoryId: category?.id ?? null,
    category,
    tags: postTags,
    views: 0,
    likes: 0,
    wordCount: rendered.wordCount,
    readingTime: Math.max(1, Math.ceil(rendered.wordCount / 380)),
    isTop: Boolean(data.isTop),
    publishedAt: date || null,
    createdAt: date,
    updatedAt: updated || date,
  }

  return {
    post,
    detail: {
      contentHtml: withBaseHtml(rendered.html, base),
      toc: rendered.toc,
    },
    search: {
      slug,
      title,
      summary,
      tags: tagNames,
      text: stripMarkdown(body),
    },
  }
}

export function generateContent(inputBase = process.env.VITE_BASE || '/'): void {
  const base = normalizeBase(inputBase)
  const includeDrafts = process.env.VITE_INCLUDE_DRAFTS === '1'

  const siteRaw = readJson<Record<string, unknown>>(join(CONTENT_DIR, 'site.json'), {})
  const categoriesRaw = readJson<Omit<Category, 'id' | 'postCount'>[]>(
    join(CONTENT_DIR, 'categories.json'),
    [],
  )
  const linksRaw = readJson<Omit<FriendLink, 'id'>[]>(join(CONTENT_DIR, 'links.json'), [])
  const tagSlugsRaw = readJson<{ name: string; slug: string }[]>(
    join(CONTENT_DIR, 'tags.json'),
    [],
  )
  const tagSlugByName = new Map(tagSlugsRaw.map((tag) => [tag.name, tag.slug]))
  const aboutSource = existsSync(join(CONTENT_DIR, 'about.md'))
    ? readFileSync(join(CONTENT_DIR, 'about.md'), 'utf8')
    : String(siteRaw.aboutContent || '')

  const now = Date.now()
  const publishedFiles = readMarkdownDir(join(CONTENT_DIR, 'posts'))
  const draftFiles = includeDrafts ? readMarkdownDir(join(CONTENT_DIR, 'drafts')) : []
  const allPostFiles = [...publishedFiles, ...draftFiles]

  const categories: Category[] = categoriesRaw.map((item, index) => ({
    id: index + 1,
    name: item.name,
    slug: item.slug,
    description: item.description || '',
    sort: item.sort ?? index,
    postCount: 0,
  }))

  // 标签只保留已发布文章实际用到的，避免静态站出现一堆 0 篇文章的死标签
  const tagNames = new Set<string>()
  for (const entry of allPostFiles) {
    if (entry.data.draft) continue
    if (Array.isArray(entry.data.tags)) {
      for (const name of entry.data.tags) tagNames.add(String(name))
    }
  }
  const tags: Tag[] = [...tagNames]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((name, index) => ({
      id: index + 1,
      name,
      slug: tagSlugByName.get(name) || slugifyTag(name),
      postCount: 0,
    }))
  const tagsByName = new Map(tags.map((tag) => [tag.name, tag]))

  const posts: Post[] = []
  const details = new Map<number, PostDetail>()
  const search: SearchItem[] = []

  for (const entry of allPostFiles) {
    const isDraft = Boolean(entry.data.draft)
    const date = isoDate(String(entry.data.date || ''))
    const isFuture = date ? Date.parse(date) > now : false

    if (!includeDrafts && (isDraft || isFuture)) continue

    const result = postFrom(entry.file, entry.body, entry.data, categories, tagsByName, base)
    posts.push(result.post)
    details.set(result.post.id, result.detail)
    search.push(result.search)

    for (const tag of result.post.tags) tag.postCount += 1
    if (result.post.categoryId) {
      const category = categories.find((item) => item.id === result.post.categoryId)
      if (category) category.postCount += 1
    }
  }

  posts.sort((a, b) => {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
    return Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '')
  })

  const notes: Note[] = readMarkdownDir(join(CONTENT_DIR, 'notes'))
    .map((entry) => {
      const data = entry.data as unknown as NoteMeta
      const date = isoDate(String(data.date || ''))
      const isDraft = Boolean(data.draft)
      const isFuture = date ? Date.parse(date) > now : false
      if (!includeDrafts && (isDraft || isFuture)) return null

      const id = Number(data.id) || hashString(`${date}-${entry.body.slice(0, 32)}`)
      const images = Array.isArray(data.images) ? data.images.map(String) : []
      const note: Note = {
        id,
        content: entry.body.trim(),
        images: images.map((image) => withBase(image, base)),
        status: 'published',
        publishedAt: date || null,
        createdAt: date,
        updatedAt: date,
          }
      return note
    })
    .filter((note): note is Note => Boolean(note))
    .sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))

  const links: FriendLink[] = linksRaw.map((item, index) => ({
    id: index + 1,
    name: item.name,
    url: item.url,
    avatar: withBase(item.avatar || '', base),
    description: item.description || '',
    sort: item.sort ?? index,
  }))

  const aboutHtml = withBaseHtml(renderMarkdown(aboutSource).html, base)

  const heroBackgrounds = Array.isArray(siteRaw.heroBackgrounds)
    ? siteRaw.heroBackgrounds.map((item) => withBase(String(item), base))
    : []

  const site: SiteInfo['site'] = {
    url: String(siteRaw.url || ''),
    name: String(siteRaw.name || 'chibarie'),
    description: String(siteRaw.description || ''),
    keywords: String(siteRaw.keywords || ''),
    icp: String(siteRaw.icp || ''),
    avatar: withBase(String(siteRaw.avatar || ''), base),
    heroBackground: heroBackgrounds[0] || '',
    heroBackgrounds,
    pageBackground: withBase(String(siteRaw.pageBackground || ''), base),
    aboutContent: aboutSource,
    aboutHtml,
    socials: {
      bilibili: String((siteRaw.socials as Record<string, string> | undefined)?.bilibili || ''),
      github: String((siteRaw.socials as Record<string, string> | undefined)?.github || ''),
      steam: String((siteRaw.socials as Record<string, string> | undefined)?.steam || ''),
      location: String((siteRaw.socials as Record<string, string> | undefined)?.location || ''),
    },
  }

  const index = {
    site: {
      ...site,
      // aboutContent 保留原文；前端改用 aboutHtml
    },
    stats: {
      postCount: posts.length,
      categoryCount: categories.length,
      tagCount: tags.length,
        wordCount: posts.reduce((total, post) => total + post.wordCount, 0),
      views: 0,
      likes: 0,
    },
    posts,
    categories,
    tags,
    notes,
    links,
    archive: posts.map<ArchiveItem>((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    })),
  }

  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(POSTS_OUT, { recursive: true })
  mkdirSync(PUBLIC_DATA, { recursive: true })

  for (const post of posts) {
    const detail = details.get(post.id)
    if (!detail) continue
    writeFileSync(join(POSTS_OUT, `${post.id}.json`), JSON.stringify(detail), 'utf8')
  }

  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index), 'utf8')
  writeFileSync(join(PUBLIC_DATA, 'search.json'), JSON.stringify(search), 'utf8')

  console.log(
    `[content] base=${base} posts=${posts.length} notes=${notes.length} ` +
      `tags=${tags.length} categories=${categories.length}`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  generateContent()
}
