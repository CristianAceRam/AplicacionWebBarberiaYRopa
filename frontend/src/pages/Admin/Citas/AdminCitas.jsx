import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import { useAdminCitas } from '../../../hooks/useAdminCitas.js'
import { estadoDerivado, ahoraMadridISO, ESTADO } from '../../../utils/estadoCita.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import CalendarioMes from '../../../components/CalendarioMes/CalendarioMes.jsx'
import styles from './AdminCitas.module.css'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import ConfirmInline from '../../../components/ui/ConfirmInline.jsx'

function pad(n) { return String(n).padStart(2, '0') }
function isoLocal(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const HOY = isoLocal(new Date())
function parseFechaLocal(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function formatFechaNav(str) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(parseFechaLocal(str))
}
function avanzarDia(fecha, delta) {
  const d = parseFechaLocal(fecha)
  d.setDate(d.getDate() + delta)
  return isoLocal(d)
}
function formatTel(t) {
  return t.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
}

const ESTADO_CONFIG = {
  [ESTADO.RESERVADA]:  { color: 'var(--text)'  },
  [ESTADO.REALIZADA]:  { color: '#6FD08C'      },
  [ESTADO.NO_ASISTIO]: { color: 'var(--error)' },
  [ESTADO.CANCELADA]:  { color: 'var(--faint)' },
}

export default function AdminCitas() {
  const { fetchWithAuth } = useAuth()
  const [fecha, setFecha] = useState(HOY)
  const { citas, setCitas, clienteMap, servicioMap, cargando, error, recargar } = useAdminCitas(fecha)

  const [calAbierto,    setCalAbierto]    = useState(false)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [accionConfirm, setAccionConfirm] = useState(null) // 'noasistida' | 'cancelar'
  const [procesandoId,  setProcesandoId]  = useState(null)
  const [errorCita,     setErrorCita]     = useState(null) // { id, msg }

  const ahora  = ahoraMadridISO()
  const ocupado = procesandoId !== null

  async function handleNoAsistida(cita) {
    setProcesandoId(cita.id)
    setConfirmandoId(null)
    setAccionConfirm(null)
    setErrorCita(null)
    setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: 'no_asistida' } : c))
    try {
      const data = await fetchWithAuth(`/citas/${cita.id}/no-asistida`, { method: 'PATCH' })
      setCitas(prev => prev.map(c => c.id === data.id ? data : c))
    } catch (err) {
      setCitas(prev => prev.map(c => c.id === cita.id ? cita : c))
      let msg = 'No se pudo marcar como no asistida.'
      if (err instanceof ApiError && err.data?.detail && typeof err.data.detail === 'string') {
        msg = err.data.detail
      }
      setErrorCita({ id: cita.id, msg })
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleCancelar(cita) {
    setProcesandoId(cita.id)
    setConfirmandoId(null)
    setAccionConfirm(null)
    setErrorCita(null)
    setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: 'cancelada' } : c))
    try {
      const data = await fetchWithAuth(`/citas/${cita.id}/cancelar`, { method: 'PATCH' })
      setCitas(prev => prev.map(c => c.id === data.id ? data : c))
    } catch (err) {
      setCitas(prev => prev.map(c => c.id === cita.id ? cita : c))
      let msg = 'No se pudo cancelar la cita.'
      if (err instanceof ApiError && err.data?.detail && typeof err.data.detail === 'string') {
        msg = err.data.detail
      }
      setErrorCita({ id: cita.id, msg })
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Agenda / citas</h2>

      <div className={styles.selectorFecha}>
        <button
          className={styles.btnNavFecha}
          onClick={() => setFecha(f => avanzarDia(f, -1))}
          aria-label="Día anterior"
        >
          ‹
        </button>

        <button
          className={styles.btnFechaToggle}
          onClick={() => setCalAbierto(v => !v)}
          aria-expanded={calAbierto}
          aria-label={`Fecha: ${formatFechaNav(fecha)}. ${calAbierto ? 'Cerrar' : 'Abrir'} calendario`}
        >
          {formatFechaNav(fecha)} {calAbierto ? '▴' : '▾'}
        </button>

        <button
          className={styles.btnNavFecha}
          onClick={() => setFecha(f => avanzarDia(f, +1))}
          aria-label="Día siguiente"
        >
          ›
        </button>

        {fecha !== HOY && (
          <button className={styles.btnHoy} onClick={() => setFecha(HOY)}>
            Hoy
          </button>
        )}
      </div>

      {calAbierto && (
        <div className={styles.calendarPanel}>
          <CalendarioMes
            fechaSeleccionada={fecha}
            onSeleccionar={(str) => { setFecha(str); setCalAbierto(false) }}
          />
        </div>
      )}

      {cargando && <EstadoCargando mensaje="Cargando citas…" />}

      {!cargando && (
        <AnimatedContent>
          {error && (
            <EstadoError mensaje="No se pudo cargar las citas." onReintentar={recargar} />
          )}

          {!error && citas.length === 0 && (
            <p className={styles.vacio}>No hay citas este día.</p>
          )}

          {!error && citas.length > 0 && (
        <ul className={styles.lista}>
          {citas.map(cita => {
            const derivado  = estadoDerivado(cita, ahora)
            const cliente   = clienteMap[cita.cliente_id]
            const servicio  = servicioMap[cita.servicio_id]
            const config    = ESTADO_CONFIG[derivado] ?? ESTADO_CONFIG[ESTADO.CANCELADA]
            const tieneAccion = derivado === ESTADO.REALIZADA || derivado === ESTADO.RESERVADA

            return (
              <li key={cita.id} className={styles.citaItem}>
                <div className={styles.citaMain}>
                  <div className={styles.citaCabecera}>
                    <span className={styles.citaHora}>
                      {cita.hora_inicio.slice(0, 5)} – {cita.hora_fin.slice(0, 5)}
                    </span>
                    <div className={styles.estadoFila}>
                      <span
                        className={styles.punto}
                        style={{ background: config.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.estadoLabel} style={{ color: config.color }}>
                        {derivado}
                      </span>
                    </div>
                  </div>

                  <p className={styles.citaNombre}>
                    {cliente ? cliente.nombre_completo : 'Cliente no disponible'}
                  </p>

                  {cliente && (
                    <a
                      href={`tel:${cliente.telefono}`}
                      className={styles.citaTelLink}
                      aria-label={`Llamar a ${cliente.nombre_completo}: ${formatTel(cliente.telefono)}`}
                    >
                      {formatTel(cliente.telefono)}
                    </a>
                  )}

                  <p className={styles.citaServicio}>
                    {servicio ? servicio.nombre : 'Servicio no disponible'}
                  </p>
                </div>

                {tieneAccion && confirmandoId !== cita.id && (
                  <div className={styles.citaAcciones}>
                    {derivado === ESTADO.REALIZADA && (
                      <CtaSecondary
                        size="sm"
                        danger
                        disabled={ocupado}
                        onClick={() => {
                          setErrorCita(null)
                          setConfirmandoId(cita.id)
                          setAccionConfirm('noasistida')
                        }}
                      >
                        No asistió
                      </CtaSecondary>
                    )}
                    {derivado === ESTADO.RESERVADA && (
                      <CtaSecondary
                        size="sm"
                        disabled={ocupado}
                        onClick={() => {
                          setErrorCita(null)
                          setConfirmandoId(cita.id)
                          setAccionConfirm('cancelar')
                        }}
                      >
                        Cancelar
                      </CtaSecondary>
                    )}
                  </div>
                )}

                {confirmandoId === cita.id && (
                  <ConfirmInline
                    msg={accionConfirm === 'noasistida'
                      ? `¿${cliente ? cliente.nombre_completo : 'El cliente'} no se presentó?`
                      : `¿Cancelar la cita de ${cliente ? cliente.nombre_completo : 'este cliente'}?`}
                    labelSi={procesandoId === cita.id ? '…' : 'Sí'}
                    onNo={() => setConfirmandoId(null)}
                    onSi={() => accionConfirm === 'noasistida' ? handleNoAsistida(cita) : handleCancelar(cita)}
                    disabled={ocupado}
                    peligro={accionConfirm === 'noasistida'}
                  />
                )}

                {errorCita?.id === cita.id && (
                  <p role="alert" className={styles.errorCitaItem}>{errorCita.msg}</p>
                )}
              </li>
            )
          })}
        </ul>
          )}
        </AnimatedContent>
      )}
    </div>
  )
}
