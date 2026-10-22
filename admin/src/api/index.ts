import { get, post, put, del, upload, type PageData } from './client'
import type {
  Category,
  Comment,
  CommentStatus,
  CommentType,
  FriendLink,
  LinkPayload,
  Note,
  NotePayload,
  Post,
  PostPayload,
  PostStatus,
  SiteInfo,
  Tag,
  User,
} from './types'

export * from './types'
export type { PageData } from './client'
export { getToken, setToken, clearToken } from './client'

export interface LoginResult {
  token: string
  user: User
}

export interface SiteSettingsData {
  site: {
    name: string
    description: string
    keywords: string
    icp: string
    avatar: string
    heroBackground: string
    heroBackgrounds: string[]
    pageBackground: string
    aboutContent: string
    socials: {
      bilibili: string
      github: string
      steam: string
      location: string
    }
  }
  defaults: {
    name: string
    description: string
    keywords: string
    icp: string
  }
}

export interface SettingsPayload {
  name: string
  description: string
  keywords: string
  icp: string
  avatar: string
  heroBackground: string
  heroBackgrounds: string[]
  pageBackground: string
  aboutContent: string
  bilibili: string
  github: string
  steam: string
  location: string
}

export const fetchAdminSettings = () => get<SiteSettingsData>('/admin/settings')

export const updateSettings = (payload: SettingsPayload) =>
  put<{ site: SiteSettingsData['site'] }>('/admin/settings', payload)

export const login = (username: string, password: string) =>
  post<LoginResult>('/auth/login', { username, password })

export const fetchProfile = () => get<User>('/auth/profile')

export const changePassword = (oldPassword: string, newPassword: string) =>
  put<{ ok: boolean }>('/auth/password', {
    oldPassword,
    newPassword,
  })

export const fetchSiteInfo = () => get<SiteInfo>('/site/info')

export interface AdminPostQuery {
  page?: number
  pageSize?: number
  categoryId?: number
  keyword?: string
}

export const fetchAdminPosts = (params: AdminPostQuery = {}) =>
  get<PageData<Post>>('/admin/posts', params as Record<string, unknown>)

export const fetchAdminPost = (id: number | string) =>
  get<Post>(`/admin/posts/${id}`)

export const createPost = (payload: PostPayload) =>
  post<Post>('/admin/posts', payload)

export const updatePost = (id: number, payload: PostPayload) =>
  put<Post>(`/admin/posts/${id}`, payload)

export const deletePost = (id: number) =>
  del<{ id: number; deleted: boolean }>(`/admin/posts/${id}`)

export interface UploadResult {
  url: string
  filename: string
  size: number
}

export const uploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return upload<UploadResult>('/admin/upload', form)
}

export const fetchCategories = () => get<Category[]>('/categories')

export const createCategory = (payload: {
  name: string
  slug?: string
  description?: string
  sort?: number
}) => post<Category>('/admin/categories', payload)

export const updateCategory = (
  id: number,
  payload: { name: string; slug?: string; description?: string; sort?: number },
) => put<Category>(`/admin/categories/${id}`, payload)

export const deleteCategory = (id: number) =>
  del<{ id: number; deleted: boolean }>(`/admin/categories/${id}`)

export const fetchTags = () => get<Tag[]>('/tags')

export const createTag = (payload: { name: string; slug?: string }) =>
  post<Tag>('/admin/tags', payload)

export const updateTag = (id: number, payload: { name: string; slug?: string }) =>
  put<Tag>(`/admin/tags/${id}`, payload)

export const deleteTag = (id: number) =>
  del<{ id: number; deleted: boolean }>(`/admin/tags/${id}`)

// ===== 友链 =====

export const fetchLinks = () => get<FriendLink[]>('/links')

export const createLink = (payload: LinkPayload) =>
  post<FriendLink>('/admin/links', payload)

export const updateLink = (id: number, payload: LinkPayload) =>
  put<FriendLink>(`/admin/links/${id}`, payload)

export const deleteLink = (id: number) =>
  del<{ deleted: boolean }>(`/admin/links/${id}`)

// ===== 说说 =====

export interface AdminNoteQuery {
  page?: number
  pageSize?: number
  status?: PostStatus | ''
}

export const fetchAdminNotes = (params: AdminNoteQuery = {}) =>
  get<PageData<Note>>('/admin/notes', params as Record<string, unknown>)

export const createNote = (payload: NotePayload) =>
  post<Note>('/admin/notes', payload)

export const updateNote = (id: number, payload: NotePayload) =>
  put<Note>(`/admin/notes/${id}`, payload)

export const deleteNote = (id: number) =>
  del<{ id: number; deleted: boolean }>(`/admin/notes/${id}`)

export interface AdminCommentQuery {
  page?: number
  pageSize?: number
  status?: CommentStatus | ''
  type?: CommentType | ''
  postId?: number
}

export const fetchAdminComments = (params: AdminCommentQuery = {}) =>
  get<PageData<Comment>>('/admin/comments', params as Record<string, unknown>)

export const updateCommentStatus = (id: number, status: CommentStatus) =>
  put<{ id: number; status: CommentStatus }>(`/admin/comments/${id}/status`, {
    status,
  })

export const deleteComment = (id: number) =>
  del<{ id: number; deleted: boolean }>(`/admin/comments/${id}`)
