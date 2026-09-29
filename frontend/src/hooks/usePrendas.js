import { useState, useEffect } from 'react'
import { apiFetch } from '../api/api.js'

export function usePrendas() {
  const [prendas, setPrendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    apiFetch('/prendas')
      .then(data => {
        if (!cancelado) {
          setPrendas(data)
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
  }, [tick])

  return { prendas, cargando, error, recargar }
}
