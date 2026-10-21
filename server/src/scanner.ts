import fs from 'node:fs'
import path from 'node:path'
import { db } from './db.js'

// 规则见 docs/comic-storage-spec.md
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'])
const collator = new Intl.Collator('zh-CN', { numeric: true })

const isImage = (name: string) => IMAGE_EXTS.has(path.extname(name).toLowerCase())

function list(dir: string, kind: 'dir' | 'image'): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .filter((e) => (kind === 'dir' ? e.isDirectory() : e.isFile() && isImage(e.name)))
    .map((e) => e.name)
    .sort(collator.compare)
}

const upsertComic = db.prepare<[number, string, string | null, number], { id: number }>(`
  INSERT INTO comics (library_id, dir_name, cover_file, chapter_count) VALUES (?, ?, ?, ?)
  ON CONFLICT (library_id, dir_name) DO UPDATE SET cover_file = excluded.cover_file, chapter_count = excluded.chapter_count
  RETURNING id
`)
const upsertChapter = db.prepare<[number, string, number, number], { id: number }>(`
  INSERT INTO chapters (comic_id, dir_name, sort_index, page_count) VALUES (?, ?, ?, ?)
  ON CONFLICT (comic_id, dir_name) DO UPDATE SET sort_index = excluded.sort_index, page_count = excluded.page_count
  RETURNING id
`)
const deletePages = db.prepare('DELETE FROM pages WHERE chapter_id = ?')
const insertPage = db.prepare('INSERT INTO pages (chapter_id, file_name, sort_index) VALUES (?, ?, ?)')

// 删除本次扫描未出现的记录：用 json_each 传入保留的 id 列表
const pruneComics = db.prepare(
  'DELETE FROM comics WHERE library_id = ? AND id NOT IN (SELECT value FROM json_each(?))',
)
const pruneChapters = db.prepare(
  'DELETE FROM chapters WHERE comic_id = ? AND id NOT IN (SELECT value FROM json_each(?))',
)

type ChapterScan = { dirName: string; pages: string[] }
type ComicScan = { dirName: string; cover: string | null; chapters: ChapterScan[] }

function readLibrary(root: string): ComicScan[] {
  const comics: ComicScan[] = []
  for (const comicDir of list(root, 'dir')) {
    const comicPath = path.join(root, comicDir)
    const rootImages = list(comicPath, 'image')
    const cover = rootImages.find((f) => path.parse(f).name.toLowerCase() === 'cover') ?? null
    let chapters = list(comicPath, 'dir')
      .map((dirName) => ({ dirName, pages: list(path.join(comicPath, dirName), 'image') }))
      .filter((c) => c.pages.length > 0)
    // 无章节目录时，漫画目录下平铺的图片作为单章（dirName 为空串，即漫画目录本身）
    if (chapters.length === 0) chapters = [{ dirName: '', pages: rootImages.filter((f) => f !== cover) }]
    if (chapters[0].pages.length === 0) continue
    comics.push({ dirName: comicDir, cover, chapters })
  }
  return comics
}

export function scanLibrary(libraryId: number, root: string) {
  // 先完成所有磁盘读取，再在单个事务里写库
  const comics = readLibrary(root)

  db.transaction(() => {
    const comicIds: number[] = []
    for (const comic of comics) {
      const { id: comicId } = upsertComic.get(libraryId, comic.dirName, comic.cover, comic.chapters.length)!
      comicIds.push(comicId)

      const chapterIds: number[] = []
      comic.chapters.forEach((chapter, i) => {
        const { id: chapterId } = upsertChapter.get(comicId, chapter.dirName, i, chapter.pages.length)!
        chapterIds.push(chapterId)
        deletePages.run(chapterId)
        chapter.pages.forEach((file, j) => insertPage.run(chapterId, file, j))
      })
      pruneChapters.run(comicId, JSON.stringify(chapterIds))
    }
    pruneComics.run(libraryId, JSON.stringify(comicIds))
    db.prepare("UPDATE libraries SET scanned_at = datetime('now') WHERE id = ?").run(libraryId)
  })()

  return { comics: comics.length }
}
