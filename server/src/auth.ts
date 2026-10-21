import crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { db } from './db.js'

const COOKIE = 'token'

// 密码哈希格式与根目录 reset_pass.js 保持一致
function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, 'hex'))
}

type Admin = { username: string; password_hash: string }

// 首次启动没有管理员时自动生成随机密码并打印到控制台
if (!db.prepare('SELECT 1 FROM admin').get()) {
  const password = crypto.randomBytes(9).toString('base64url')
  db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run('comic', hashPassword(password))
  console.log(`\n[comic-shelf] 已初始化管理员账号 comic，初始密码：${password}\n[comic-shelf] 重置密码：node reset_pass.js <新密码>\n`)
}

function readToken(req: FastifyRequest) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1]
}

// 不做内存缓存，reset_pass.js 清空 tokens 后立即生效
const isValid = (token: string | undefined) => !!token && !!db.prepare('SELECT 1 FROM tokens WHERE token = ?').get(token)

const setCookie = (reply: FastifyReply, value: string, maxAge: number) =>
  reply.header('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`)

export function registerAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url === '/api/login') return
    if (!isValid(readToken(req))) return reply.code(401).send({ message: '未登录' })
  })

  app.post<{ Body: { username: string; password: string } }>('/api/login', (req, reply) => {
    const admin = db.prepare('SELECT username, password_hash FROM admin').get() as Admin
    if (req.body.username !== admin.username || !verifyPassword(req.body.password, admin.password_hash)) {
      return reply.code(401).send({ message: '账号或密码错误' })
    }
    const token = crypto.randomBytes(32).toString('hex')
    db.prepare('INSERT INTO tokens (token) VALUES (?)').run(token)
    setCookie(reply, token, 365 * 24 * 3600)
    return { ok: true }
  })

  app.post('/api/logout', (req, reply) => {
    const token = readToken(req)!
    db.prepare('DELETE FROM tokens WHERE token = ?').run(token)
    setCookie(reply, '', 0)
    return { ok: true }
  })
}
