import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fs from 'node:fs'
import path from 'node:path'
import { db } from './db.js'
import { scanLibrary } from './scanner.js'
import { registerAuth } from './auth.js'

const PORT = Number(process.env.PORT ?? 10101)
const HOST = process.env.HOST ?? '127.0.0.1'
const webDist = path.resolve(import.meta.dirname, '../../web/dist')

const app = Fastify({ logger: true })

// 生产环境托管前端；开发环境由 Vite 代理 /api
const serveWeb = process.env.NODE_ENV === 'production'
await app.register(fastifyStatic, { root: serveWeb ? webDist : import.meta.dirname, serve: serveWeb })

registerAuth(app)

type IdParams = { Params: { id: string } }

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

function getLibrary(id: number | string) {
  const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(id) as { id: number; path: string } | undefined
  if (!lib) throw new HttpError(404, '资源库不存在')
  return lib
}

// ---------- 资源库 ----------

app.get('/api/libraries', () =>
  db
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM comics c WHERE c.library_id = l.id) AS comic_count
       FROM libraries l ORDER BY l.id`,
    )
    .all(),
)

app.post<{ Body: { path: string } }>('/api/libraries', (req) => {
  const root = path.resolve(req.body.path.trim())
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new HttpError(400, `目录不存在：${root}`)
  if (db.prepare('SELECT 1 FROM libraries WHERE path = ?').get(root)) throw new HttpError(409, '该目录已添加')

  const { lastInsertRowid } = db
    .prepare('INSERT INTO libraries (path, name) VALUES (?, ?)')
    .run(root, path.basename(root))
  const result = scanLibrary(Number(lastInsertRowid), root)
  return { id: Number(lastInsertRowid), ...result }
})

app.post<IdParams>('/api/libraries/:id/scan', (req) => {
  const lib = getLibrary(req.params.id)
  return scanLibrary(lib.id, lib.path)
})

app.delete<IdParams>('/api/libraries/:id', (req) => {
  db.prepare('DELETE FROM libraries WHERE id = ?').run(getLibrary(req.params.id).id)
  return { ok: true }
})

// ---------- 漫画 / 章节 ----------

app.get<{ Querystring: { libraryId?: string; q?: string } }>('/api/comics', (req) => {
  const { libraryId, q } = req.query
  return db
    .prepare(
      `SELECT id, library_id, dir_name AS title, chapter_count FROM comics
       WHERE (@libraryId IS NULL OR library_id = @libraryId)
         AND (@q IS NULL OR dir_name LIKE '%' || @q || '%')
       ORDER BY dir_name COLLATE NOCASE`,
    )
    .all({ libraryId: libraryId ?? null, q: q || null })
})

app.get<IdParams>('/api/comics/:id', (req) => {
  const comic = db
    .prepare('SELECT id, library_id, dir_name AS title, chapter_count FROM comics WHERE id = ?')
    .get(req.params.id)
  if (!comic) throw new HttpError(404, '漫画不存在')
  const chapters = db
    .prepare(`SELECT id, CASE dir_name WHEN '' THEN '全一话' ELSE dir_name END AS title, page_count FROM chapters WHERE comic_id = ? ORDER BY sort_index`)
    .all(req.params.id)
  return { ...comic, chapters }
})

app.get<IdParams>('/api/chapters/:id', (req) => {
  const chapter = db
    .prepare(
      `SELECT ch.id, CASE ch.dir_name WHEN '' THEN '全一话' ELSE ch.dir_name END AS title, ch.sort_index, ch.comic_id, c.dir_name AS comic_title,
         (SELECT id FROM chapters WHERE comic_id = ch.comic_id AND sort_index = ch.sort_index - 1) AS prev_id,
         (SELECT id FROM chapters WHERE comic_id = ch.comic_id AND sort_index = ch.sort_index + 1) AS next_id
       FROM chapters ch JOIN comics c ON c.id = ch.comic_id WHERE ch.id = ?`,
    )
    .get(req.params.id)
  if (!chapter) throw new HttpError(404, '章节不存在')
  const pages = db
    .prepare('SELECT id FROM pages WHERE chapter_id = ? ORDER BY sort_index')
    .all(req.params.id) as { id: number }[]
  return { ...chapter, pages: pages.map((p) => p.id) }
})

// ---------- 图片 ----------

app.get<IdParams>('/api/pages/:id/image', (req, reply) => {
  const row = db
    .prepare(
      `SELECT l.path AS root, c.dir_name AS comic, ch.dir_name AS chapter, p.file_name AS file
       FROM pages p JOIN chapters ch ON ch.id = p.chapter_id JOIN comics c ON c.id = ch.comic_id
       JOIN libraries l ON l.id = c.library_id WHERE p.id = ?`,
    )
    .get(req.params.id) as { root: string; comic: string; chapter: string; file: string } | undefined
  if (!row) throw new HttpError(404, '图片不存在')
  return reply.sendFile(row.file, path.join(row.root, row.comic, row.chapter), { maxAge: '7d' })
})

app.get<IdParams>('/api/comics/:id/cover', (req, reply) => {
  const comic = db
    .prepare(
      `SELECT l.path AS root, c.dir_name AS comic, c.cover_file AS cover FROM comics c
       JOIN libraries l ON l.id = c.library_id WHERE c.id = ?`,
    )
    .get(req.params.id) as { root: string; comic: string; cover: string | null } | undefined
  if (!comic) throw new HttpError(404, '漫画不存在')
  if (comic.cover) return reply.sendFile(comic.cover, path.join(comic.root, comic.comic), { maxAge: '1h' })

  // 无封面时用第一章第一页
  const first = db
    .prepare(
      `SELECT p.id FROM chapters ch JOIN pages p ON p.chapter_id = ch.id
       WHERE ch.comic_id = ? ORDER BY ch.sort_index, p.sort_index LIMIT 1`,
    )
    .get(req.params.id) as { id: number }
  return reply.redirect(`/api/pages/${first.id}/image`)
})

if (serveWeb) app.setNotFoundHandler((req, reply) => reply.sendFile('index.html'))

app.listen({ port: PORT, host: HOST })
