import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(import.meta.dirname, '../../data')
fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'comic-shelf.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS libraries (
    id          INTEGER PRIMARY KEY,
    path        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    scanned_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS comics (
    id             INTEGER PRIMARY KEY,
    library_id     INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    dir_name       TEXT NOT NULL,
    cover_file     TEXT,
    chapter_count  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (library_id, dir_name)
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id          INTEGER PRIMARY KEY,
    comic_id    INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
    dir_name    TEXT NOT NULL,
    sort_index  INTEGER NOT NULL,
    page_count  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (comic_id, dir_name)
  );

  CREATE TABLE IF NOT EXISTS pages (
    id          INTEGER PRIMARY KEY,
    chapter_id  INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    file_name   TEXT NOT NULL,
    sort_index  INTEGER NOT NULL,
    UNIQUE (chapter_id, file_name)
  );

  -- 单管理员账号，密码为 scrypt 哈希 "salt:hash"
  CREATE TABLE IF NOT EXISTS admin (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    username       TEXT NOT NULL,
    password_hash  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token       TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chapters_comic ON chapters(comic_id, sort_index);
  CREATE INDEX IF NOT EXISTS idx_pages_chapter ON pages(chapter_id, sort_index);
`)
