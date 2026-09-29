import { useState, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import { useAdminExcepciones } from '../../../hooks/useAdminExcepciones.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import ConfirmInline from '../../../components/ui/ConfirmInline.jsx'
import CalendarioMes from '../../../components/CalendarioMes/CalendarioMes.jsx'
import styles from './AdminExcepciones.module.css'

const HORAS = (() => {
  const opts = []
  for (let h = 0; h <= 23; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`)
    opts.push(`${String(h).padStart(2, '0')}:30`)
  }
  return opts
})()

function nuevoTramo() { return { apertura: '09:00', cierre: '14:00' } }

function parseFechaISO(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HOY = isoLocal(new Date())

function maxFechaISO() {
  const max = new Date()
  max.setDate(max.getDate() + 150)
  return isoLocal(max)
}

function formatFecha(str) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(parseFechaISO(str))
}

function sortExcepciones(arr) {
  return [...arr].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export default function AdminExcepciones() {
  const { fetchWithAuth } = useAuth()
  const { excepciones, setExcepciones, cargando, error, recargar } = useAdminExcepciones()

  const [modoForm,      setModoForm]      = useState(null)
  const [fechaForm,     setFechaForm]     = useState('')
  const [tramosForm,    setTramosForm]    = useState([nuevoTramo()])
  const [enviando,      setEnviando]      = useState(false)
  const [errorForm,     setErrorForm]     = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [borrando,      setBorrando]      = useState(null)
  const [errorBorrado,  setErrorBorrado]  = useState(null)

  const maxFecha = maxFechaISO()
  const fechasUsadas = useMemo(
    () => new Set(excepciones.map(e => e.fecha)),
    [excepciones]
  )

  if (cargando) return <EstadoCargando mensaje="Cargando excepciones…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudieron cargar las excepciones." onReintentar={recargar} /></AnimatedContent>

  const excepcionesFuturas = excepciones.filter(e => e.fecha >= HOY)
  const ocupado = borrando !== null || enviando

  function abrirForm(modo) {
    setModoForm(modo)
    setFechaForm(HOY)
    setTramosForm([nuevoTramo()])
    setErrorForm(null)
  }

  function cerrarForm() {
    setModoForm(null)
    setFechaForm('')
    setTramosForm([nuevoTramo()])
    setErrorForm(null)
  }

  function añadirTramoForm() {
    setTramosForm(prev => [...prev, nuevoTramo()])
  }

  function quitarTramoForm(i) {
    if (tramosForm.length <= 1) return
    setTramosForm(prev => prev.filter((_, idx) => idx !== i))
  }

  function actualizarTramoForm(i, campo, valor) {
    setTramosForm(prev => prev.map((t, idx) => idx === i ? { ...t, [campo]: valor } : t))
    setErrorForm(null)
  }

  async function handleCrear() {
    if (!fechaForm) { setErrorForm('Selecciona una fecha.'); return }

    if (modoForm === 'abierto') {
      if (tramosForm.length === 0) { setErrorForm('Añade al menos un tramo.'); return }
      for (const t of tramosForm) {
        if (t.apertura >= t.cierre) { setErrorForm('Cada tramo debe tener apertura anterior al cierre.'); return }
      }
    }

    setEnviando(true)
    setErrorForm(null)

    const body = { fecha: fechaForm, tipo: modoForm }
    if (modoForm === 'abierto') {
      body.tramos = tramosForm.map(t => ({ hora_apertura: t.apertura, hora_cierre: t.cierre }))
    }

    try {
      const data = await fetchWithAuth('/excepciones', { method: 'POST', body })
      setExcepciones(prev => sortExcepciones([...prev, data]))
      cerrarForm()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorForm(err.data?.detail ?? 'Conflicto al crear la excepción.')
        } else if (err.status === 422) {
          const detail = err.data?.detail
          if (Array.isArray(detail) && detail.length > 0) {
            setErrorForm(detail[0].msg)
          } else if (typeof detail === 'string') {
            setErrorForm(detail)
          } else {
            setErrorForm('Datos inválidos. Revisa los campos.')
          }
        } else {
          setErrorForm('No se pudo crear la excepción. Inténtalo de nuevo.')
        }
      } else {
        setErrorForm('No se pudo crear la excepción. Inténtalo de nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function handleBorrar(exc) {
    const excRef = exc
    setBorrando(exc.id)
    setConfirmandoId(null)
    setErrorBorrado(null)
    setExcepciones(prev => prev.filter(e => e.id !== exc.id))
    try {
      await fetchWithAuth(`/excepciones/${exc.id}`, { method: 'DELETE' })
    } catch (err) {
      setExcepciones(prev => sortExcepciones([...prev, excRef]))
      let msg = 'No se pudo eliminar la excepción. Inténtalo de nuevo.'
      if (err instanceof ApiError && err.status === 409) {
        msg = err.data?.detail ?? msg
      }
      setErrorBorrado({ id: excRef.id, msg })
    } finally {
      setBorrando(null)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Días cerrados y aperturas</h2>

      <div className={styles.accionesFila}>
        <CtaSecondary
          size="sm"
          disabled={ocupado || modoForm !== null}
          onClick={() => abrirForm('cerrado')}
        >
          Cerrar un día
        </CtaSecondary>
        <CtaSecondary
          size="sm"
          disabled={ocupado || modoForm !== null}
          onClick={() => abrirForm('abierto')}
        >
          Abrir un día
        </CtaSecondary>
      </div>

      {modoForm && (
        <div className={styles.form}>
          <p className={styles.formTitulo}>
            {modoForm === 'cerrado' ? 'Cerrar un día' : 'Apertura excepcional'}
          </p>

          <CalendarioMes
            fechaSeleccionada={fechaForm}
            onSeleccionar={str => { setFechaForm(str); setErrorForm(null) }}
            minFecha={HOY}
            maxFecha={maxFecha}
            esDeshabilitado={str => str < HOY || str > maxFecha || fechasUsadas.has(str)}
          />

          {modoForm === 'abierto' && (
            <div className={styles.formCampo}>
              <span className={styles.label}>Tramos horarios</span>
              <div className={styles.tramosFormLista}>
                {tramosForm.map((t, i) => (
                  <div key={i} className={styles.tramoFormFila}>
                    <select
                      className={styles.selectHora}
                      value={t.apertura}
                      onChange={e => actualizarTramoForm(i, 'apertura', e.target.value)}
                      disabled={enviando}
                      aria-label={`Apertura del tramo ${i + 1}`}
                    >
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className={styles.separador}>–</span>
                    <select
                      className={styles.selectHora}
                      value={t.cierre}
                      onChange={e => actualizarTramoForm(i, 'cierre', e.target.value)}
                      disabled={enviando}
                      aria-label={`Cierre del tramo ${i + 1}`}
                    >
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {tramosForm.length > 1 && (
                      <button
                        type="button"
                        className={styles.btnQuitarTramoForm}
                        onClick={() => quitarTramoForm(i)}
                        disabled={enviando}
                        aria-label={`Quitar tramo ${i + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.btnAnadirTramoForm}
                  onClick={añadirTramoForm}
                  disabled={enviando}
                >
                  + Añadir tramo
                </button>
              </div>
            </div>
          )}

          {errorForm && <p role="alert" className={styles.errorForm}>{errorForm}</p>}

          <div className={styles.formBotones}>
            <CtaSecondary size="sm" disabled={enviando} onClick={cerrarForm}>
              Cancelar
            </CtaSecondary>
            <CtaSecondary size="sm" disabled={enviando || !fechaForm} onClick={handleCrear}>
              {enviando
                ? 'Guardando…'
                : modoForm === 'cerrado'
                  ? 'Cerrar este día'
                  : 'Crear apertura'}
            </CtaSecondary>
          </div>
        </div>
      )}

      {excepcionesFuturas.length === 0 ? (
        <p className={styles.vacio}>No hay excepciones programadas.</p>
      ) : (
        <>
          <p className={styles.seccionLabel}>Excepciones programadas</p>
          <ul className={styles.lista}>
            {excepcionesFuturas.map(exc => (
              <li key={exc.id} className={styles.excepcionItem}>
                <div className={styles.excepcionCabecera}>
                  <div className={styles.excepcionFechaWrap}>
                    <span className={styles.excepcionFecha}>{formatFecha(exc.fecha)}</span>
                    {exc.tipo === 'cerrado'
                      ? <span className={styles.badgeCerrado}>Cerrado</span>
                      : <span className={styles.badgeAbierto}>Abierto</span>}
                  </div>
                  {confirmandoId !== exc.id && (
                    <button
                      type="button"
                      className={styles.btnQuitar}
                      disabled={ocupado}
                      onClick={() => { setErrorBorrado(null); setConfirmandoId(exc.id) }}
                      aria-label={`Eliminar excepción del ${formatFecha(exc.fecha)}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {confirmandoId === exc.id && (
                  <ConfirmInline
                    msg={exc.tipo === 'cerrado' ? '¿Borrar este día cerrado?' : '¿Borrar esta apertura excepcional?'}
                    labelSi="Sí, borrar"
                    onNo={() => setConfirmandoId(null)}
                    onSi={() => handleBorrar(exc)}
                    disabled={borrando !== null}
                    peligro
                  />
                )}

                {exc.tipo === 'abierto' && exc.tramos.length > 0 && (
                  <ul className={styles.tramosExcepcion}>
                    {exc.tramos.map((t, i) => (
                      <li key={i} className={styles.tramoExcepcionFila}>
                        {t.hora_apertura.slice(0, 5)} – {t.hora_cierre.slice(0, 5)}
                      </li>
                    ))}
                  </ul>
                )}

                {errorBorrado?.id === exc.id && (
                  <p role="alert" className={styles.errorBorrado}>{errorBorrado.msg}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
    </AnimatedContent>
  )
}
