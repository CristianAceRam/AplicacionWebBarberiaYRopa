import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import { useAdminHorario } from '../../../hooks/useAdminHorario.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './AdminHorario.module.css'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const HORAS = (() => {
  const opts = []
  for (let h = 0; h <= 23; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`)
    opts.push(`${String(h).padStart(2, '0')}:30`)
  }
  return opts
})()

const FORM_DEFECTO = { apertura: '09:00', cierre: '14:00' }

function sortTramos(arr) {
  return [...arr].sort((a, b) =>
    a.dia_semana !== b.dia_semana
      ? a.dia_semana - b.dia_semana
      : a.hora_apertura.localeCompare(b.hora_apertura)
  )
}

export default function AdminHorario() {
  const { fetchWithAuth } = useAuth()
  const { tramos, setTramos, cargando, error, recargar } = useAdminHorario()

  const [abrirFormDia,       setAbrirFormDia]       = useState(null)
  const [formHoras,          setFormHoras]           = useState(FORM_DEFECTO)
  const [errorFormHoras,     setErrorFormHoras]      = useState(null)
  const [añadiendo,          setAñadiendo]           = useState(false)
  const [errorAnadir,        setErrorAnadir]         = useState(null) // { dia, msg }
  const [confirmandoBorrado, setConfirmandoBorrado]  = useState(null) // id
  const [borrando,           setBorrando]            = useState(null) // id
  const [errorBorrado,       setErrorBorrado]        = useState(null) // { id, msg }

  if (cargando) return <EstadoCargando mensaje="Cargando horario…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudo cargar el horario." onReintentar={recargar} /></AnimatedContent>

  const tramosXDia = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [i, tramos.filter(t => t.dia_semana === i)])
  )

  function abrirForm(dia) {
    setAbrirFormDia(dia)
    setFormHoras(FORM_DEFECTO)
    setErrorFormHoras(null)
    setErrorAnadir(null)
  }

  function cerrarForm() {
    setAbrirFormDia(null)
    setFormHoras(FORM_DEFECTO)
    setErrorFormHoras(null)
    setErrorAnadir(null)
  }

  async function handleAnadir(dia) {
    if (formHoras.apertura >= formHoras.cierre) {
      setErrorFormHoras('La apertura debe ser anterior al cierre.')
      return
    }
    setAñadiendo(true)
    setErrorAnadir(null)
    try {
      const data = await fetchWithAuth('/horario', {
        method: 'POST',
        body: {
          dia_semana:    dia,
          hora_apertura: formHoras.apertura,
          hora_cierre:   formHoras.cierre,
        },
      })
      setTramos(prev => sortTramos([...prev, data]))
      cerrarForm()
    } catch (err) {
      let msg = 'No se pudo añadir el tramo. Inténtalo de nuevo.'
      if (err instanceof ApiError && err.status === 409)
        msg = 'Se solapa con otro tramo de este día.'
      setErrorAnadir({ dia, msg })
    } finally {
      setAñadiendo(false)
    }
  }

  async function handleBorrar(tramo) {
    const tramoRef = tramo
    setBorrando(tramo.id)
    setConfirmandoBorrado(null)
    setErrorBorrado(null)
    setTramos(prev => prev.filter(t => t.id !== tramo.id))
    try {
      await fetchWithAuth(`/horario/${tramo.id}`, { method: 'DELETE' })
    } catch {
      setTramos(prev => sortTramos([...prev, tramoRef]))
      setErrorBorrado({ id: tramoRef.id, msg: 'No se pudo eliminar el tramo. Inténtalo de nuevo.' })
    } finally {
      setBorrando(null)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Horario semanal</h2>

      <ul className={styles.diasLista}>
        {DIAS.map((nombreDia, dia) => {
          const tramosDelDia = tramosXDia[dia] ?? []
          const formAbierto  = abrirFormDia === dia
          const hayBorrado   = borrando !== null

          return (
            <li key={dia} className={styles.diaItem}>

              {/* Cabecera del día */}
              <div className={styles.diaCabecera}>
                <span className={styles.diaNombre}>{nombreDia}</span>
                <button
                  type="button"
                  className={styles.btnAnadir}
                  disabled={hayBorrado || añadiendo}
                  onClick={() => formAbierto ? cerrarForm() : abrirForm(dia)}
                  aria-expanded={formAbierto}
                >
                  {formAbierto ? '× Cancelar' : '+ Añadir tramo'}
                </button>
              </div>

              {/* Tramos existentes */}
              {tramosDelDia.length === 0 && !formAbierto && (
                <p className={styles.cerrado}>Cerrado</p>
              )}

              {tramosDelDia.length > 0 && (
                <ul className={styles.tramosLista}>
                  {tramosDelDia.map(tramo => (
                    <li key={tramo.id}>
                      <div className={styles.tramoFila}>
                        <span className={styles.tramoHoras}>
                          {tramo.hora_apertura.slice(0, 5)} – {tramo.hora_cierre.slice(0, 5)}
                        </span>
                        {confirmandoBorrado === tramo.id ? (
                          <div className={styles.confirmInline}>
                            <CtaSecondary
                              size="sm"
                              disabled={hayBorrado}
                              onClick={() => setConfirmandoBorrado(null)}
                            >
                              No
                            </CtaSecondary>
                            <CtaSecondary
                              size="sm"
                              danger
                              disabled={hayBorrado}
                              onClick={() => handleBorrar(tramo)}
                            >
                              Sí, borrar
                            </CtaSecondary>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={styles.btnQuitar}
                            disabled={hayBorrado || añadiendo}
                            onClick={() => { setErrorBorrado(null); setConfirmandoBorrado(tramo.id) }}
                            aria-label={`Quitar tramo ${tramo.hora_apertura.slice(0,5)}–${tramo.hora_cierre.slice(0,5)}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {errorBorrado?.id === tramo.id && (
                        <p role="alert" className={styles.errorTramo}>{errorBorrado.msg}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Mini-form añadir tramo */}
              {formAbierto && (
                <div className={styles.miniForm}>
                  <div className={styles.miniFormSelects}>
                    <label className={styles.selectLabel}>
                      <span className={styles.selectCaption}>Apertura</span>
                      <select
                        className={styles.selectHora}
                        value={formHoras.apertura}
                        onChange={e => { setFormHoras(p => ({ ...p, apertura: e.target.value })); setErrorFormHoras(null) }}
                        disabled={añadiendo}
                      >
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                    <label className={styles.selectLabel}>
                      <span className={styles.selectCaption}>Cierre</span>
                      <select
                        className={styles.selectHora}
                        value={formHoras.cierre}
                        onChange={e => { setFormHoras(p => ({ ...p, cierre: e.target.value })); setErrorFormHoras(null) }}
                        disabled={añadiendo}
                      >
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                  </div>

                  {errorFormHoras && (
                    <p role="alert" className={styles.errorForm}>{errorFormHoras}</p>
                  )}
                  {errorAnadir?.dia === dia && (
                    <p role="alert" className={styles.errorForm}>{errorAnadir.msg}</p>
                  )}

                  <div className={styles.miniFormAcciones}>
                    <CtaSecondary size="sm" disabled={añadiendo} onClick={cerrarForm}>
                      Cancelar
                    </CtaSecondary>
                    <CtaSecondary size="sm" disabled={añadiendo} onClick={() => handleAnadir(dia)}>
                      {añadiendo ? 'Añadiendo…' : 'Añadir'}
                    </CtaSecondary>
                  </div>
                </div>
              )}

            </li>
          )
        })}
      </ul>
    </div>
    </AnimatedContent>
  )
}
