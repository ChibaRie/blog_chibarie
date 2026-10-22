export interface User {
  id: number
  username: string
  nickname: string
  email: string
  avatar: string
  bio: string
  role: string
  createdAt?: string
}

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

export type PostStatus = 'draft' | 'published'

export interface Post {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  contentHtml: string
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
  commentCount: number
}

export type CommentStatus = 'pending' | 'approved' | 'rejected'

export type CommentType = 'post' | 'guestbook' | 'note'

export interface Comment {
  id: number
  type: CommentType
  postId: number
  postTitle?: string
  parentId: number | null
  nickname: string
  website: string
  content: string
  status: CommentStatus
  createdAt: string
}

/** 说说：短文本时间流 */
export interface Note {
  id: number
  content: string
  images: string[]
  likes: number
  status: PostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  commentCount: number
}

export interface NotePayload {
  content: string
  images: string[]
  status: PostStatus
  /** 带本地时区偏移的 RFC3339；null 表示不动（已发布的保留原值） */
  publishedAt?: string | null
}

export interface SiteInfo {
  site: {
    name: string
    description: string
    keywords: string
    icp: string
  }
  stats: {
    postCount: number
    categoryCount: number
    tagCount: number
    commentCount: number
    wordCount: number
    views: number
    likes: number
  }
}

export interface FriendLink {
  id: number
  name: string
  url: string
  avatar: string
  description: string
  sort: number
  createdAt: string
  updatedAt: string
}

export interface LinkPayload {
  name: string
  url: string
  avatar?: string
  description?: string
  sort?: number
}

export interface PostPayload {
  title: string
  slug?: string
  summary?: string
  content: string
  cover?: string
  status: PostStatus
  categoryId: number | null
  tagIds: number[]
  isTop: boolean
  /**
   * 发布日期，需带时区偏移的 RFC3339 字符串（如 2026-07-11T10:00:00+08:00）。
   * 传 null 表示不动：已发布的保留原值，草稿则等真正发布时自动填当前时间。
   */
  publishedAt?: string | null
}
