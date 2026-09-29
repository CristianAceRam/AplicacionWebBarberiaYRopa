import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminServicios() {
  const { fetchWithAuth } = useAuth()
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const silenciosoRef = useRef(false)

  const recargar = () => setTick(t => t + 1)

  const recargarSilencioso = () => {
    silenciosoRef.current = true
    setTick(t => t + 1)
  }

  useEffect(() => {
    let cancelado = false
    const esSilencioso = silenciosoRef.current
    silenciosoRef.current = false

    if (!esSilencioso) {
      setCargando(true)
      setError(null)
    }

    fetchWithAuth('/servicios?incluir_inactivos=true')
      .then(data => {
        if (!cancelado) {
          setServicios(Array.isArray(data) ? data : [])
          setCargando(false)
        }
      })
      .catch(() => {
        if (!cancelado && !esSilencioso) {
          setError('error')
          setCargando(false)
        }
      })
    return () => { cancelado = true }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { servicios, setServicios, cargando, error, recargar, recargarSilencioso }
}
