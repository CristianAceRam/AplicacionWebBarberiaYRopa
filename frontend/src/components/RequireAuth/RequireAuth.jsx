import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

// Protege rutas que exigen sesión. Mientras rehidrata (cargando) espera sin redirigir.
export default function RequireAuth({ children }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return null
  if (!usuario) return <Navigate to="/login" state={{ from: location }} replace />
  return children ?? <Outlet />
}

// Scaffolded para el panel admin (sin rutas todavía; se usa cuando Alex decida el layout)
export function RequireAdmin({ children }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return null
  if (!usuario) return <Navigate to="/login" state={{ from: location }} replace />
  if (usuario.rol !== 'admin') return <Navigate to="/" replace />
  return children ?? <Outlet />
}
