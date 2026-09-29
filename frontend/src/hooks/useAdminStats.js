import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminStats() {
  const { fetchWithAuth } = useAuth()
  const [stats,    setStats]    = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)
  const [tick,     setTick]     = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    fetchWithAuth('/admin/stats')
      .then(data => {
        if (!cancelado) { setStats(data); setCargando(false) }
      })
      .catch(() => {
        if (!cancelado) { setError('error'); setCargando(false) }
      })

    return () => { cancelado = true }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { stats, cargando, error, recargar }
}