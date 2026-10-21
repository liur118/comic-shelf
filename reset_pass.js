// 重置管理员密码：node reset_pass.js <新密码>
const crypto = require('node:crypto')
const path = require('node:path')
const Database = require('better-sqlite3')

const password = process.argv[2]
if (!password) {
  console.error('用法：node reset_pass.js <新密码>')
  process.exit(1)
}

const db = new Database(path.join(__dirname, 'data/comic-shelf.db'), { fileMustExist: true })
// 哈希格式与 server/src/auth.ts 保持一致
const salt = crypto.randomBytes(16).toString('hex')
const hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
if (db.prepare('UPDATE admin SET password_hash = ?').run(hash).changes === 0) {
  console.error('未找到管理员账号，请先启动一次服务完成初始化')
  process.exit(1)
}
db.prepare('DELETE FROM tokens').run()
console.log('管理员 admin 密码已重置，所有登录状态已失效')
