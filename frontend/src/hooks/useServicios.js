import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useServicios() {
  const { fetchWithAuth } = useAuth()
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    fetchWithAuth('/servicios')
      .then(data => {
        if (!cancelado) {
          setServicios(data)
          setCargando(false)
        }
      })
      .catch(() => {
        if (!cancelado) {
          setError('error')
          setCargando(false)
        }
      })
    return () => { cancelado = true }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  // fetchWithAuth omitido intencionalmente: RequireAuth garantiza sesión activa.

  return { servicios, cargando, error, recargar }
}
