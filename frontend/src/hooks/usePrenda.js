import { useState, useEffect } from 'react'
import { apiFetch, ApiError } from '../api/api.js'

export function usePrenda(id) {
  const [prenda, setPrenda] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    apiFetch(`/prendas/${id}`)
      .then(data => {
        if (!cancelado) {
          setPrenda(data)
          setCargando(false)
        }
      })
      .catch(err => {
        if (!cancelado) {
          setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'error')
          setCargando(false)
        }
      })
    return () => { cancelado = true }
  }, [id, tick])

  return { prenda, cargando, error, recargar }
}
