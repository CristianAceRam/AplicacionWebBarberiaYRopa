import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useReservas() {
  const { fetchWithAuth } = useAuth()
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const silenciosoRef = useRef(false)

  // Con spinner (error inicial, usuario pulsa "Reintentar")
  const recargar = () => setTick(t => t + 1)

  // Sin spinner (422 en cancelación — lista permanece visible)
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

    fetchWithAuth('/reservas/mias')
      .then(data => {
        if (!cancelado) {
          const sorted = [...data].sort(
            (a, b) => new Date(b.creada_en) - new Date(a.creada_en)
          )
          setReservas(sorted)
          setCargando(false)
        }
      })
      .catch(() => {
        if (!cancelado && !esSilencioso) {
          setError('error')
          setCargando(false)
        }
        // Silencioso: fallo de red → se ignora, lista existente permanece
      })
    return () => { cancelado = true }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  // fetchWithAuth omitido intencionalmente: RequireAuth garantiza sesión activa;
  // ahora es useCallback([token]) en AuthContext, seguro de omitir.

  return { reservas, setReservas, cargando, error, recargar, recargarSilencioso }
}
