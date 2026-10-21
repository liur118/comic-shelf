export type Library = { id: number; path: string; name: string; scanned_at: string | null; comic_count: number }
export type ComicSummary = { id: number; library_id: number; title: string; chapter_count: number }
export type ChapterSummary = { id: number; title: string; page_count: number }
export type ComicDetail = ComicSummary & { chapters: ChapterSummary[] }
export type ChapterDetail = {
  id: number
  title: string
  comic_id: number
  comic_title: string
  prev_id: number | null
  next_id: number | null
  pages: number[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  // token 失效或未登录：跳转登录页（登录接口本身的 401 交给页面处理）
  if (res.status === 401 && url !== '/api/login') {
    location.href = `/login?redirect=${encodeURIComponent(location.pathname)}`
    return new Promise<T>(() => {})
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? res.statusText)
  return data
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body ? { 'Content-Type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
})

export const api = {
  login: (username: string, password: string) => request('/api/login', json('POST', { username, password })),
  logout: () => request('/api/logout', json('POST')),
  libraries: () => request<Library[]>('/api/libraries'),
  addLibrary: (path: string) => request<{ id: number; comics: number }>('/api/libraries', json('POST', { path })),
  scanLibrary: (id: number) => request<{ comics: number }>(`/api/libraries/${id}/scan`, json('POST')),
  deleteLibrary: (id: number) => request(`/api/libraries/${id}`, json('DELETE')),
  comics: (q: string) => request<ComicSummary[]>(`/api/comics?q=${encodeURIComponent(q)}`),
  comic: (id: string) => request<ComicDetail>(`/api/comics/${id}`),
  chapter: (id: string) => request<ChapterDetail>(`/api/chapters/${id}`),
  coverUrl: (id: number) => `/api/comics/${id}/cover`,
  pageUrl: (id: number) => `/api/pages/${id}/image`,
}
