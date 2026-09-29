import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminGaleria() {
  const { fetchWithAuth } = useAuth()
  const [fotos, setFotos] = useState([])
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

    fetchWithAuth('/galeria')
      .then(data => {
        if (!cancelado) {
          setFotos(Array.isArray(data) ? data : [])
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

  return { fotos, setFotos, cargando, error, recargar, recargarSilencioso }
}
