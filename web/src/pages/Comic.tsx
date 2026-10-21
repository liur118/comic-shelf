import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type ComicDetail } from '../api'

export default function Comic() {
  const { id } = useParams()
  const [comic, setComic] = useState<ComicDetail | null>(null)

  useEffect(() => {
    api.comic(id!).then(setComic)
  }, [id])

  if (!comic) return null

  return (
    <div className="comic">
      <img className="comic-cover" src={api.coverUrl(comic.id)} alt={comic.title} />
      <div className="comic-body">
        <h1>{comic.title}</h1>
        <p className="muted">共 {comic.chapter_count} 章</p>
        <Link className="button primary" to={`/read/${comic.chapters[0].id}`}>开始阅读</Link>
        <ul className="chapters">
          {comic.chapters.map((ch) => (
            <li key={ch.id}>
              <Link to={`/read/${ch.id}`} title={`${ch.page_count} 页`}>{ch.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
