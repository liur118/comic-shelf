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

// 登录限流：同一 IP 连续失败 MAX_FAILS 次后锁定 LOCK_MS，成功登录清零
const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000
const fails = new Map<string, { count: number; lockedUntil: number }>()

export function registerAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url === '/api/login') return
    if (!isValid(readToken(req))) return reply.code(401).send({ message: '未登录' })
  })

  app.post<{ Body: { username: string; password: string } }>('/api/login', (req, reply) => {
    const record = fails.get(req.ip)
    if (record && record.lockedUntil > Date.now()) {
      const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000)
      return reply.code(429).send({ message: `尝试次数过多，请 ${minutes} 分钟后再试` })
    }
    const admin = db.prepare('SELECT username, password_hash FROM admin').get() as Admin
    if (req.body.username !== admin.username || !verifyPassword(req.body.password, admin.password_hash)) {
      const count = (record?.count ?? 0) + 1
      if (count >= MAX_FAILS) {
        fails.set(req.ip, { count: 0, lockedUntil: Date.now() + LOCK_MS })
        return reply.code(429).send({ message: `尝试次数过多，请 ${LOCK_MS / 60000} 分钟后再试` })
      }
      fails.set(req.ip, { count, lockedUntil: 0 })
      return reply.code(401).send({ message: `账号或密码错误，还可尝试 ${MAX_FAILS - count} 次` })
    }
    fails.delete(req.ip)
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
