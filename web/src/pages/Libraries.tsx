import { useEffect, useState } from 'react'
import { api, type Library } from '../api'

export default function Libraries() {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const reload = () => api.libraries().then(setLibraries)
  useEffect(() => {
    reload()
  }, [])

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    try {
      setMessage(await action())
      await reload()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form
        className="add-library"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const r = await api.addLibrary(path)
            setPath('')
            return `已添加，扫描到 ${r.comics} 部漫画`
          })
        }}
      >
        <input placeholder="本地目录绝对路径，如 /Users/me/Comics" value={path} onChange={(e) => setPath(e.target.value)} />
        <button className="button primary" disabled={busy || !path.trim()}>添加资源库</button>
      </form>
      {message && <p className="muted">{message}</p>}

      <table className="libraries">
        <thead>
          <tr><th>路径</th><th>漫画数</th><th>上次扫描</th><th /></tr>
        </thead>
        <tbody>
          {libraries.map((lib) => (
            <tr key={lib.id}>
              <td>{lib.path}</td>
              <td>{lib.comic_count}</td>
              <td className="muted">{lib.scanned_at ?? '-'}</td>
              <td className="actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => run(async () => `扫描完成，共 ${(await api.scanLibrary(lib.id)).comics} 部漫画`)}
                >
                  重新扫描
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() =>
                    confirm(`移除资源库 ${lib.path}？（不会删除磁盘文件）`) &&
                    run(async () => (await api.deleteLibrary(lib.id), '已移除'))
                  }
                >
                  移除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
