import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ComicSummary } from '../api'

export default function Shelf() {
  const [q, setQ] = useState('')
  const [comics, setComics] = useState<ComicSummary[] | null>(null)

  useEffect(() => {
    api.comics(q).then(setComics)
  }, [q])

  if (!comics) return null

  return (
    <>
      <input className="search" placeholder="搜索漫画" value={q} onChange={(e) => setQ(e.target.value)} />
      {comics.length === 0 && !q ? (
        <p className="empty">
          书架是空的，先去 <Link to="/libraries">资源库</Link> 添加一个目录。
        </p>
      ) : (
        <div className="grid">
          {comics.map((c) => (
            <Link key={c.id} to={`/comic/${c.id}`} className="card">
              <img src={api.coverUrl(c.id)} alt={c.title} loading="lazy" />
              <div className="card-title">{c.title}</div>
              <div className="muted">{c.chapter_count} 章</div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
