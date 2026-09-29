import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useAdminCitas(fecha) {
  const { fetchWithAuth } = useAuth()
  const [citas, setCitas]         = useState([])
  const [clienteMap, setClienteMap] = useState({})
  const [servicioMap, setServicioMap] = useState({})
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState(null)
  const [tick, setTick]           = useState(0)
  const silenciosoRef             = useRef(false)

  const recargar          = () => setTick(t => t + 1)
  const recargarSilencioso = () => { silenciosoRef.current = true; setTick(t => t + 1) }

  useEffect(() => {
    let cancelado = false
    const esSilencioso = silenciosoRef.current
    silenciosoRef.current = false

    if (!esSilencioso) { setCargando(true); setError(null) }

    Promise.all([
      fetchWithAuth(`/citas?fecha=${fecha}`),
      fetchWithAuth('/servicios?incluir_inactivos=true'),
      fetchWithAuth('/usuarios'),
    ])
      .then(([citasData, serviciosData, usuariosData]) => {
        if (!cancelado) {
          setCitas(Array.isArray(citasData) ? citasData : [])
          setServicioMap(
            Object.fromEntries(
              (Array.isArray(serviciosData) ? serviciosData : []).map(s => [s.id, s])
            )
          )
          const clientes = Array.isArray(usuariosData)
            ? usuariosData.filter(u => u.rol === 'cliente')
            : []
          setClienteMap(Object.fromEntries(clientes.map(c => [c.id, c])))
          setCargando(false)
        }
      })
      .catch(() => {
        if (!cancelado && !esSilencioso) { setError('error'); setCargando(false) }
      })

    return () => { cancelado = true }
  }, [fecha, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return { citas, setCitas, clienteMap, servicioMap, cargando, error, recargar, recargarSilencioso }
}
