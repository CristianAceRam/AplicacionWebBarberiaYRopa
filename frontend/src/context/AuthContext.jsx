import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '../api/api.js'

const TOKEN_KEY = 'pistia_token'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Si hay token guardado, arrancamos en cargando=true para verificarlo antes
  // de renderizar nada. Sin token → false inmediato, sin efecto async.
  const [cargando, setCargando] = useState(() => !!localStorage.getItem(TOKEN_KEY))
  const [token,    setToken]    = useState(null)
  const [usuario,  setUsuario]  = useState(null)

  // Rehidración al montar: verifica el token guardado con el backend
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return  // cargando ya es false por el lazy initializer

    apiFetch('/usuarios/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(data => {
        setToken(stored)
        setUsuario(data)
      })
      .catch(err => {
        // Token inválido o caducado — limpia silenciosamente
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
        }
      })
      .finally(() => setCargando(false))
  }, [])

  async function login(email, password) {
    const data = await apiFetch('/login', {
      method: 'POST',
      body: { email, password },
    })
    const tok = data.access_token
    localStorage.setItem(TOKEN_KEY, tok)
    const me = await apiFetch('/usuarios/me', {
      headers: { Authorization: `Bearer ${tok}` },
    })
    setToken(tok)
    setUsuario(me)
  }

  async function register(nombre_completo, telefono, email, password) {
    await apiFetch('/registro', {
      method: 'POST',
      body: { nombre_completo, telefono, email, password },
    })
    // auto-login transparente: el usuario acaba de escribir sus credenciales
    await login(email, password)
  }

  // Stable: state setters from useState are guaranteed stable by React
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUsuario(null)
  }, [])

  // Recreates only when token changes — safe to omit from useEffect deps in hooks
  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const { headers, ...rest } = options
    try {
      return await apiFetch(path, {
        headers: { Authorization: `Bearer ${token}`, ...headers },
        ...rest,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout()
      }
      throw err
    }
  }, [token, logout])

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, login, register, logout, fetchWithAuth, setUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
