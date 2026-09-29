import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useReservas } from '../../hooks/useReservas.js'
import { ApiError } from '../../api/api.js'
import EstadoCargando from '../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../components/ui/EstadoError.jsx'
import EstadoVacio from '../../components/ui/EstadoVacio.jsx'
import CtaSecondary from '../../components/CtaSecondary/CtaSecondary.jsx'
import styles from './MisReservas.module.css'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'

const formatFecha = (iso) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))

const formatPrecio = (precio) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(precio))

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'var(--warning)' },
  atendida:  { label: 'Atendida',  color: 'var(--success)' },
  cancelada: { label: 'Cancelada', color: 'var(--faint)'   },
}

export default function MisReservas() {
  const { fetchWithAuth } = useAuth()
  const { reservas, setReservas, cargando, error, recargar, recargarSilencioso } = useReservas()

  const [cancelando, setCancelando]                 = useState(null)
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(null)
  const [errorCancelacion, setErrorCancelacion]     = useState(null)

  if (cargando) return <EstadoCargando />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudieron cargar tus reservas." onReintentar={recargar} /></AnimatedContent>

  if (!reservas.length) return (
    <AnimatedContent>
    <div className={styles.vacio}>
      <EstadoVacio mensaje="Aún no tienes reservas." />
      <Link to="/tienda" className={styles.irCatalogo}>Explorar catálogo</Link>
    </div>
    </AnimatedContent>
  )

  async function handleCancelar(id) {
    setEnviandoCancelacion(id)
    setErrorCancelacion(null)
    try {
      await fetchWithAuth(`/reservas/${id}/cancelar`, { method: 'PATCH' })
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'cancelada' } : r))
      setCancelando(null)
    } catch (err) {
      let mensaje = 'No se pudo cancelar. Inténtalo de nuevo.'
      if (err instanceof ApiError) {
        if (err.status === 422) { mensaje = 'Esta reserva ya no se puede cancelar.'; recargarSilencioso() }
        else if (err.status === 403) mensaje = 'No tienes permiso para cancelar esta reserva.'
      }
      setErrorCancelacion({ id, mensaje })
    } finally {
      setEnviandoCancelacion(null)
    }
  }

  return (
    <AnimatedContent>
    <section className={styles.seccion}>
      <h1 className={styles.titulo}>Mis reservas</h1>
      <ul className={styles.lista}>
        {reservas.map(r => {
          const cfg = ESTADO_CONFIG[r.estado] ?? ESTADO_CONFIG.cancelada
          const enConfirmacion = cancelando === r.id
          const enviando = enviandoCancelacion === r.id
          const errThis = errorCancelacion?.id === r.id

          return (
            <li
              key={r.id}
              className={styles.tarjeta}
              data-estado={r.estado}
            >
              {/* Fila estado + fecha */}
              <div className={styles.estadoFila}>
                <span
                  className={styles.punto}
                  style={{ color: cfg.color }}
                  aria-hidden="true"
                />
                <span
                  className={styles.estadoLabel}
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <span className={styles.fecha}>{formatFecha(r.creada_en)}</span>
              </div>

              {/* Datos de la prenda */}
              <p className={styles.nombrePrenda}>{r.prenda.nombre}</p>
              <p className={styles.meta}>
                Talla: {r.talla}
                <span className={styles.sep}>·</span>
                {formatPrecio(r.prenda.precio)}
              </p>

              {/* Área de acción — solo pendientes */}
              {r.estado === 'pendiente' && (
                <div className={styles.accion}>
                  {errThis && (
                    <p className={styles.errorInline} role="alert">
                      {errorCancelacion.mensaje}
                    </p>
                  )}

                  {enConfirmacion ? (
                    <>
                      <p className={styles.confirmTexto}>¿Cancelar esta reserva?</p>
                      <div className={styles.confirmBotones}>
                        <CtaSecondary
                          danger
                          size="sm"
                          disabled={enviando}
                          onClick={() => handleCancelar(r.id)}
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
                      onClick={() => { setCancelando(r.id); setErrorCancelacion(null) }}
                    >
                      Cancelar
                    </CtaSecondary>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
    </AnimatedContent>
  )
}
