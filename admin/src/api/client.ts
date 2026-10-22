import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const TOKEN_KEY = 'chibarie-admin-token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface ApiBody<T> {
  code: number
  message: string
  data: T
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const message: string =
      error?.response?.data?.message || error?.message || '请求失败'

    if (status === 401 && router.currentRoute.value.name !== 'login') {
      clearToken()
      ElMessage.error('登录已过期，请重新登录')
      void router.push({
        name: 'login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
    }

    return Promise.reject(new Error(message))
  },
)

export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data } = await client.get<ApiBody<T>>(url, { params })
  return data.data
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await client.post<ApiBody<T>>(url, body)
  return data.data
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await client.put<ApiBody<T>>(url, body)
  return data.data
}

export async function del<T>(url: string): Promise<T> {
  const { data } = await client.delete<ApiBody<T>>(url)
  return data.data
}

export async function upload<T>(url: string, form: FormData): Promise<T> {
  const { data } = await client.post<ApiBody<T>>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export default client
