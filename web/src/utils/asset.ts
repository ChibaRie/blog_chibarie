/**
 * 给写死在组件里的根路径资源补上 Vite base。
 * 构建产物里的内容路径已经由 content 生成器加过 base，不要重复调用。
 */
export function withBase(path: string): string {
  if (!path || /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:')) {
    return path
  }
  const base = import.meta.env.BASE_URL
  if (base === '/') return path
  return path.startsWith('/')
    ? `${base.replace(/\/$/, '')}${path}`
    : `${base}${path}`
}
