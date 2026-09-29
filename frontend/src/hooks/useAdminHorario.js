import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminHorario() {
  const { fetchWithAuth } = useAuth()
  const [tramos, setTramos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    fetchWithAuth('/horario')
      .then(data => {
        if (!cancelado) {
          setTramos(Array.isArray(data) ? data : [])
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

  return { tramos, setTramos, cargando, error, recargar }
}
