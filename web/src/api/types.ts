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
