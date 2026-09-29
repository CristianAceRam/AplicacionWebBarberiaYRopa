import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export function useCalendario() {
  const { fetchWithAuth } = useAuth()
  const [diasSemanaAbiertos, setDiasSemanaAbiertos] = useState(new Set())
  const [cierres, setCierres] = useState(new Set())
  const [aperturas, setAperturas] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const recargar = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    Promise.all([
      fetchWithAuth('/horario'),
      fetchWithAuth('/excepciones/proximas'),
    ])
      .then(([horario, excepciones]) => {
        if (!cancelado) {
          setDiasSemanaAbiertos(new Set(horario.map(h => h.dia_semana)))
          setCierres(new Set(
            excepciones.filter(e => e.tipo === 'cerrado').map(e => e.fecha)
          ))
          setAperturas(new Set(
            excepciones.filter(e => e.tipo === 'abierto').map(e => e.fecha)
          ))
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

  return { diasSemanaAbiertos, cierres, aperturas, cargando, error, recargar }
}
