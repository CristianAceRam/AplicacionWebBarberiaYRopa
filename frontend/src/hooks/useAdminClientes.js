import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminClientes() {
  const { fetchWithAuth } = useAuth()
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    fetchWithAuth('/usuarios')
      .then(data => {
        if (!cancelado) {
          const soloClientes = Array.isArray(data)
            ? data.filter(u => u.rol === 'cliente')
            : []
          setClientes(soloClientes)
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

  return { clientes, setClientes, cargando, error, recargar }
}
