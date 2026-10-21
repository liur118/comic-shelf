import { useState } from 'react'
import { api } from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.login(username, password)
      location.href = new URLSearchParams(location.search).get('redirect') ?? '/'
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>Comic Shelf</h1>
      <input placeholder="账号" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
      <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="button primary" disabled={!username || !password}>登录</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
