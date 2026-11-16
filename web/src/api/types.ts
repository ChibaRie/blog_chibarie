export interface Category {
  id: number
  name: string
  slug: string
  description: string
  sort: number
  postCount: number
}

export interface Tag {
  id: number
  name: string
  slug: string
  postCount: number
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface TocItem {
  id: string
  text: string
  level: number
}

export type PostStatus = 'draft' | 'published'

export interface Post {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  contentHtml: string
  toc?: TocItem[]
  cover: string
  status: PostStatus
  categoryId: number | null
  category?: Category
  tags: Tag[]
  views: number
  likes: number
  wordCount: number
  readingTime: number
  isTop: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 说说：短文本时间流的一条记录 */
export interface Note {
  id: number
  content: string
  images: string[]
  status: PostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GalleryOrientation = 'landscape' | 'portrait' | 'square'

/** 图库的一张图：所有数值都来自文件本身，标题与备注可以由博主补充 */
export interface GalleryItem {
  no: number
  source: string
  thumb: string
  src: string
  hero: string
  width: number
  height: number
  bytes: number
  thumbBytes: number
  avg: string
  orientation: GalleryOrientation
  title: string
  note: string
  collectedAt: string
}

export interface SiteInfo {
  site: {
    url: string
    name: string
    description: string
    keywords: string
    icp: string
    avatar: string
    heroBackground: string
    heroBackgrounds: string[]
    pageBackground: string
    aboutContent: string
    aboutHtml: string
    /** 首页轮播用的图库图版（构建时从 gallery 里挑出带 hero 的项） */
    heroPlates: GalleryItem[]
    /** 构建时刻，页脚展示的快照时间 */
    buildAt: string
    socials: {
      bilibili: string
      github: string
      steam: string
      location: string
    }
  }
  stats: {
    postCount: number
    categoryCount: number
    tagCount: number
    wordCount: number
    views: number
    likes: number
    galleryCount: number
    galleryBytes: number
  }
}

export interface ArchiveItem {
  id: number
  title: string
  slug: string
  publishedAt: string | null
  createdAt: string
}

export interface FriendLink {
  id: number
  name: string
  url: string
  avatar: string
  description: string
  sort: number
}
