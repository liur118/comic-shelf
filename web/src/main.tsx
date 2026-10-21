import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Shelf from './pages/Shelf'
import Comic from './pages/Comic'
import Reader from './pages/Reader'
import Libraries from './pages/Libraries'
import Login from './pages/Login'
import { api } from './api'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route
          path="*"
          element={
            <>
              <header className="topbar">
                <NavLink to="/" className="brand">Comic Shelf</NavLink>
                <nav>
                  <NavLink to="/" end>书架</NavLink>
                  <NavLink to="/libraries">资源库</NavLink>
                </nav>
                <button className="logout" onClick={() => api.logout().then(() => (location.href = '/login'))}>
                  退出登录
                </button>
              </header>
              <main>
                <Routes>
                  <Route path="/" element={<Shelf />} />
                  <Route path="/comic/:id" element={<Comic />} />
                  <Route path="/libraries" element={<Libraries />} />
                </Routes>
              </main>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
