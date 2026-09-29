import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useCitas } from '../../hooks/useCitas.js'
import { useServicios } from '../../hooks/useServicios.js'
import { ApiError } from '../../api/api.js'
import { ESTADO, estadoDerivado, ahoraMadridISO } from '../../utils/estadoCita.js'
import EstadoCargando from '../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../components/ui/EstadoError.jsx'
import EstadoVacio from '../../components/ui/EstadoVacio.jsx'
import CtaSecondary from '../../components/CtaSecondary/CtaSecondary.jsx'
import styles from './MisCitas.module.css'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'

function formatFechaCita(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  // Constructor local (no UTC) — evita bug de día-anterior en algunos navegadores
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(y, m - 1, d))
}

const ESTADO_COLOR = {
  [ESTADO.RESERVADA]:  'var(--text)',
  [ESTADO.REALIZADA]:  'var(--success)',
  [ESTADO.NO_ASISTIO]: 'var(--error)',
  [ESTADO.CANCELADA]:  'var(--faint)',
}

export default function MisCitas() {
  const { fetchWithAuth } = useAuth()
  const {
    citas, setCitas, cargando: citasCargando, error: citasError,
    recargar, recargarSilencioso,
  } = useCitas()
  const {
    servicios, cargando: servCargando, error: servError,
    recargar: recargarServ,
  } = useServicios()

  const [cancelando, setCancelando]                   = useState(null)
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(null)
  const [errorCancelacion, setErrorCancelacion]       = useState(null)

  if (citasCargando || servCargando) {
    return <EstadoCargando mensaje="Cargando tus citas…" />
  }
  if (citasError || servError) {
    return (
      <AnimatedContent>
      <EstadoError
        mensaje="No se pudieron cargar tus citas."
        onReintentar={() => { recargar(); recargarServ() }}
      />
      </AnimatedContent>
    )
  }

  if (!citas.length) {
    return (
      <AnimatedContent>
      <div className={styles.vacio}>
        <h1 className={styles.titulo}>Mis citas</h1>
        <EstadoVacio mensaje="Todavía no tienes citas." />
        <Link to="/barberia" className={styles.irReservar}>Reservar cita</Link>
      </div>
      </AnimatedContent>
    )
  }

  const servicioMap = Object.fromEntries(servicios.map(s => [s.id, s]))

  // Clasificar — una sola pasada, ahora Madrid fija para todo el render
  const ahora = ahoraMadridISO()
  const proximas   = []
  const anteriores = []
  for (const cita of citas) {
    const ed = estadoDerivado(cita, ahora)
    if (ed === ESTADO.RESERVADA) proximas.push({ cita, ed })
    else                          anteriores.push({ cita, ed })
  }
  // Backend entrega asc → reverse da desc (más reciente primero) para Anteriores
  const anterioresDesc = anteriores.slice().reverse()

  async function handleCancelar(id) {
    setEnviandoCancelacion(id)
    setErrorCancelacion(null)
    try {
      await fetchWithAuth(`/citas/${id}/cancelar`, { method: 'PATCH' })
      // Actualización optimista: cita pasa a cancelada → se mueve a Anteriores en el render
      setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: 'cancelada' } : c))
      setCancelando(null)
    } catch (err) {
      let mensaje = 'No se pudo cancelar. Inténtalo de nuevo.'
      if (err instanceof ApiError) {
        if (err.status === 422 || err.status === 404) {
          mensaje = 'Esta cita ya no se puede cancelar.'
          recargarSilencioso()
        } else if (err.status === 403) {
          mensaje = 'No tienes permiso para cancelar esta cita.'
        }
      }
      setErrorCancelacion({ id, mensaje })
    } finally {
      setEnviandoCancelacion(null)
    }
  }

  return (
    <AnimatedContent>
    <section className={styles.seccion}>
      <h1 className={styles.titulo}>Mis citas</h1>

      {proximas.length > 0 && (
        <>
          <p className={styles.grupoLabel}>Próximas</p>
          <ul className={styles.lista}>
            {proximas.map(({ cita, ed }) => {
              const srv = servicioMap[cita.servicio_id]
              const color = ESTADO_COLOR[ed]
              const enConfirmacion = cancelando === cita.id
              const enviando = enviandoCancelacion === cita.id
              const errorEsta = errorCancelacion?.id === cita.id
                ? errorCancelacion.mensaje
                : null

              return (
                <li key={cita.id} className={`${styles.tarjeta} ${styles.tarjetaProxima}`}>
                  <div className={styles.estadoFila}>
                    <span className={styles.punto} style={{ color }} aria-hidden="true" />
                    <span className={styles.estadoLabel} style={{ color }}>{ed}</span>
                    <span className={styles.fechaHora}>
                      {formatFechaCita(cita.fecha)} · {cita.hora_inicio.slice(0, 5)}
                    </span>
                  </div>
                  <p className={styles.nombreServicio}>
                    {srv?.nombre ?? 'Servicio no disponible'}
                  </p>
                  <div className={styles.accion}>
                    {errorEsta && (
                      <p className={styles.errorInline} role="alert">{errorEsta}</p>
                    )}
                    {enConfirmacion ? (
                      <>
                        <p className={styles.confirmTexto}>¿Cancelar esta cita?</p>
                        <div className={styles.confirmBotones}>
                          <CtaSecondary
                            danger
                            size="sm"
                            disabled={enviando}
                            onClick={() => handleCancelar(cita.id)}
                          >
                            {enviando ? 'Cancelando…' : 'Sí, cancelar'}
                          </CtaSecondary>
                          <CtaSecondary
                            size="sm"
                            disabled={enviando}
                            onClick={() => setCancelando(null)}
                          >
                            No
                          </CtaSecondary>
                        </div>
                      </>
                    ) : (
                      <CtaSecondary
                        size="sm"
                        onClick={() => { setCancelando(cita.id); setErrorCancelacion(null) }}
                      >
                        Cancelar
                      </CtaSecondary>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {anterioresDesc.length > 0 && (
        <>
          <p className={styles.grupoLabel}>Anteriores</p>
          <ul className={`${styles.lista} ${styles.listaAtenuada}`}>
            {anterioresDesc.map(({ cita, ed }) => {
              const srv = servicioMap[cita.servicio_id]
              const color = ESTADO_COLOR[ed]
              return (
                <li key={cita.id} className={styles.tarjeta}>
                  <div className={styles.estadoFila}>
                    <span className={styles.punto} style={{ color }} aria-hidden="true" />
                    <span className={styles.estadoLabel} style={{ color }}>{ed}</span>
                    <span className={styles.fechaHora}>
                      {formatFechaCita(cita.fecha)} · {cita.hora_inicio.slice(0, 5)}
                    </span>
                  </div>
                  <p className={styles.nombreServicio}>
                    {srv?.nombre ?? 'Servicio no disponible'}
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
    </AnimatedContent>
  )
}
