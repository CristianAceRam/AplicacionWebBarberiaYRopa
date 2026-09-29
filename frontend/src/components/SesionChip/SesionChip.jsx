import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import styles from './SesionChip.module.css'

export default function SesionChip() {
  const { usuario, cargando, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const primerNombre = usuario?.nombre_completo?.split(' ')[0] ?? ''

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open])

  if (cargando) return null

  if (!usuario) return (
    <Link to="/login" className={styles.acceder}>Acceder</Link>
  )

  function handlePerfil() {
    setOpen(false)
    navigate('/perfil')
  }

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/')
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={styles.chipBtn}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
      >
        {primerNombre}
        <span className={styles.chevron} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {usuario?.rol === 'admin' && (
            <button
              className={`${styles.menuItem} ${styles.menuItemAdmin}`}
              role="menuitem"
              onClick={() => { navigate('/admin'); setOpen(false) }}
            >
              Panel de administración
            </button>
          )}
          <button
            className={`${styles.menuItem} ${styles.menuItemPerfil}`}
            role="menuitem"
            onClick={handlePerfil}
          >
            Mi perfil
          </button>
          <button
            className={`${styles.menuItem} ${styles.menuItemSalir}`}
            role="menuitem"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
