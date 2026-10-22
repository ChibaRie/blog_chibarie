/**
 * 静态内容 API。
 *
 * 函数签名与旧版后端 API 基本一致，视图层不需要感知数据来自 HTTP 还是构建产物。
 * 文章正文在构建时已经渲染好，这里只按需加载 posts/<id>.json。
 */
import contentJson from '@/generated/index.json'
import type {
  ArchiveItem,
  Category,
  FriendLink,
  Note,
  PageData,
  Post,
  SiteInfo,
  Tag,
  TocItem,
} from './types'

export * from './types'
export type { PageData }

interface ContentIndex {
  site: SiteInfo['site']
  stats: SiteInfo['stats']
  posts: Post[]
  categories: Category[]
  tags: Tag[]
  notes: Note[]
  links: FriendLink[]
  archive: ArchiveItem[]
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

const content = contentJson as unknown as ContentIndex

/** 构建产物里的详情文件，按需加载，不进入首屏 bundle */
const postDetails = import.meta.glob<PostDetail>('../generated/posts/*.json')

let searchCache: SearchItem[] | null = null

async function loadSearchIndex(): Promise<SearchItem[]> {
  if (searchCache) return searchCache
  const response = await fetch(`${import.meta.env.BASE_URL}data/search.json`)
  if (!response.ok) throw new Error('搜索索引加载失败')
  searchCache = (await response.json()) as SearchItem[]
  return searchCache
}

export interface PostQuery {
  page?: number
  pageSize?: number
  categoryId?: number
  tagId?: number
  keyword?: string
  sort?: 'latest' | 'views' | 'oldest'
}

const LIKED_POSTS_KEY = 'chibarie-liked-posts'
const LIKED_NOTES_KEY = 'chibarie-liked-notes'

function readIds(key: string): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.map(Number) : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: number[]): void {
  localStorage.setItem(key, JSON.stringify([...new Set(ids)]))
}

function pageOf<T>(list: T[], page = 1, pageSize = 10): PageData<T> {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.min(50, Math.max(1, Number(pageSize) || 10))
  const offset = (safePage - 1) * safeSize
  return {
    list: list.slice(offset, offset + safeSize),
    total: list.length,
    page: safePage,
    pageSize: safeSize,
  }
}

function sortPosts(list: Post[], sort: PostQuery['sort']): Post[] {
  return [...list].sort((a, b) => {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1
    const diff =
      Date.parse(a.publishedAt || a.createdAt || '') -
      Date.parse(b.publishedAt || b.createdAt || '')
    return sort === 'oldest' ? diff : -diff
  })
}

export const fetchSiteInfo = async (): Promise<SiteInfo> => ({
  site: content.site,
  stats: content.stats,
})

export async function fetchPosts(params: PostQuery = {}): Promise<PageData<Post>> {
  let list = [...content.posts]

  if (params.categoryId) {
    list = list.filter((post) => post.categoryId === params.categoryId)
  }
  if (params.tagId) {
    list = list.filter((post) => post.tags.some((tag) => tag.id === params.tagId))
  }
  if (params.keyword?.trim()) {
    const term = params.keyword.trim().toLowerCase()
    const search = await loadSearchIndex()
    const slugs = new Set(
      search
        .filter((item) =>
          [item.title, item.summary, item.text, ...item.tags]
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
        .map((item) => item.slug),
    )
    list = list.filter((post) => slugs.has(post.slug))
  }

  return pageOf(sortPosts(list, params.sort), params.page, params.pageSize)
}

export async function fetchPost(idOrSlug: string | number): Promise<Post> {
  const key = decodeURIComponent(String(idOrSlug))
  const meta = content.posts.find(
    (post) => post.slug === key || String(post.id) === key,
  )
  if (!meta) throw new Error('文章不存在或尚未发布')

  const loader = postDetails[`../generated/posts/${meta.id}.json`]
  if (!loader) throw new Error('文章内容文件缺失')

  const detail = await loader()
  const liked = readIds(LIKED_POSTS_KEY).includes(meta.id)
  return {
    ...meta,
    ...detail,
    likes: meta.likes + (liked ? 1 : 0),
  }
}

export async function likePost(id: number): Promise<{ id: number; likes: number }> {
  const liked = readIds(LIKED_POSTS_KEY)
  if (!liked.includes(id)) writeIds(LIKED_POSTS_KEY, [...liked, id])
  const meta = content.posts.find((post) => post.id === id)
  return { id, likes: (meta?.likes || 0) + 1 }
}

export const fetchCategories = async (): Promise<Category[]> => content.categories

export const fetchTags = async (): Promise<Tag[]> => content.tags

// ===== 说说 =====

export async function fetchNotes(
  params: { page?: number; pageSize?: number } = {},
): Promise<PageData<Note>> {
  const liked = readIds(LIKED_NOTES_KEY)
  const list = content.notes.map((note) => ({
    ...note,
    likes: note.likes + (liked.includes(note.id) ? 1 : 0),
  }))
  return pageOf(list, params.page, params.pageSize)
}

export const fetchArchive = async (): Promise<ArchiveItem[]> => content.archive

export const fetchLinks = async (): Promise<FriendLink[]> => content.links
