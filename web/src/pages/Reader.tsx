import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type ChapterDetail } from '../api'

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<ChapterDetail | null>(null)
  // 阅读模式下点击图片区域呼出的浮层（顶部面包屑 + 底部翻章按钮）
  const [overlay, setOverlay] = useState(false)

  useEffect(() => {
    api.chapter(id!).then((ch) => {
      setChapter(ch)
      setOverlay(false)
      window.scrollTo(0, 0)
    })
  }, [id])

  // 浮层显示时一滚动就收起，不挡画面
  useEffect(() => {
    if (!overlay) return
    const startY = window.scrollY
    const onScroll = () => Math.abs(window.scrollY - startY) > 40 && setOverlay(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [overlay])

  // ← / → 切换章节；↑ / ↓ 滚动：单按平滑滚动大半屏，长按连续快速滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && chapter?.prev_id) navigate(`/read/${chapter.prev_id}`)
      if (e.key === 'ArrowRight' && chapter?.next_id) navigate(`/read/${chapter.next_id}`)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const step = e.repeat ? 80 : window.innerHeight * 0.6
        window.scrollBy({ top: e.key === 'ArrowDown' ? step : -step, behavior: e.repeat ? 'instant' : 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapter, navigate])

  if (!chapter) return null

  const crumbs = (
    <nav className="reader-crumbs">
      <Link to="/">首页</Link>
      <span className="sep">›</span>
      <Link to={`/comic/${chapter.comic_id}`} className="crumb-comic">{chapter.comic_title}</Link>
      <span className="sep">›</span>
      <span className="crumb-current">{chapter.title}</span>
    </nav>
  )

  const prev = chapter.prev_id
    ? <Link to={`/read/${chapter.prev_id}`} className="chapter-btn">‹ 上一章</Link>
    : <span className="chapter-btn disabled">已是第一章</span>
  const next = chapter.next_id
    ? <Link to={`/read/${chapter.next_id}`} className="chapter-btn primary">下一章 ›</Link>
    : <span className="chapter-btn disabled">已是最新章</span>

  return (
    <div className="reader">
      {crumbs}

      <div className="reader-pages" onClick={() => setOverlay((v) => !v)}>
        {chapter.pages.map((p) => (
          <img key={p} src={api.pageUrl(p)} loading="lazy" alt="" />
        ))}
      </div>

      <div className="reader-end">
        <p className="reader-end-title">{chapter.title} · 完</p>
        <div className="chapter-btns">{prev}{next}</div>
        <Link to={`/comic/${chapter.comic_id}`} className="reader-end-toc">返回目录</Link>
      </div>

      <div className={`reader-overlay top${overlay ? ' show' : ''}`}>{crumbs}</div>
      <div className={`reader-overlay bottom${overlay ? ' show' : ''}`}>
        <div className="chapter-btns">
          {prev}
          <Link to={`/comic/${chapter.comic_id}`} className="chapter-btn toc">目录</Link>
          {next}
        </div>
      </div>
    </div>
  )
}
