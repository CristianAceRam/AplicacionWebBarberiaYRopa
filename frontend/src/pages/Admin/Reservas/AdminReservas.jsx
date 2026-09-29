import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useAdminReservas } from '../../../hooks/useAdminReservas.js'
import { ApiError } from '../../../api/api.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import ConfirmInline from '../../../components/ui/ConfirmInline.jsx'
import styles from './AdminReservas.module.css'

const formatFecha = (iso) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'var(--warning)' },
  atendida:  { label: 'Atendida',  color: 'var(--success)' },
  cancelada: { label: 'Cancelada', color: 'var(--faint)'   },
}

const CONFIRM_CONFIG = {
  atender:    { msg: '¿Marcar como atendida?',                              btn: 'Sí, atendida'  },
  cancelar:   { msg: '¿Cancelar esta reserva? Recuerda avisar al cliente.', btn: 'Sí, cancelar'  },
  desatender: { msg: '¿Volver a pendiente?',                                btn: 'Sí, desatender' },
}

export default function AdminReservas() {
  const { fetchWithAuth } = useAuth()
  const { reservas, setReservas, cargando, error, recargar, recargarSilencioso } = useAdminReservas()

  const [confirmandoId,     setConfirmandoId]     = useState(null)
  const [confirmandoAccion, setConfirmandoAccion] = useState(null)
  const [procesandoId,      setProcesandoId]      = useState(null)
  const [errorAccion,       setErrorAccion]       = useState(null) // { id, mensaje }

  if (cargando) return <EstadoCargando mensaje="Cargando reservas…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudieron cargar las reservas." onReintentar={recargar} /></AnimatedContent>

  const pendientes = reservas.filter(r => r.estado === 'pendiente')
  const atendidas  = reservas.filter(r => r.estado === 'atendida')
  const canceladas = reservas.filter(r => r.estado === 'cancelada')

  function iniciarConfirm(reserva, accion) {
    setConfirmandoId(reserva.id)
    setConfirmandoAccion(accion)
    setErrorAccion(null)
  }

  function cancelarConfirm() {
    setConfirmandoId(null)
    setConfirmandoAccion(null)
  }

  async function ejecutarAccion(reserva, accion) {
    const RUTAS = {
      atender:    `/reservas/${reserva.id}/atender`,
      cancelar:   `/reservas/${reserva.id}/cancelar`,
      desatender: `/reservas/${reserva.id}/desatender`,
    }
    setProcesandoId(reserva.id)
    setConfirmandoId(null)
    setConfirmandoAccion(null)
    setErrorAccion(null)
    try {
      const data = await fetchWithAuth(RUTAS[accion], { method: 'PATCH' })
      setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, estado: data.estado } : r))
    } catch (err) {
      let mensaje = 'No se pudo realizar la acción. Inténtalo de nuevo.'
      if (err instanceof ApiError && (err.status === 422 || err.status === 404)) {
        recargarSilencioso()
        mensaje = 'El estado ha cambiado. La lista se ha actualizado.'
      }
      setErrorAccion({ id: reserva.id, mensaje })
    } finally {
      setProcesandoId(null)
    }
  }

  function renderTarjeta(reserva) {
    const cfg        = ESTADO_CONFIG[reserva.estado] ?? ESTADO_CONFIG.cancelada
    const enConfirm  = confirmandoId === reserva.id
    const procesando = procesandoId === reserva.id
    const errorEsta  = errorAccion?.id === reserva.id ? errorAccion.mensaje : null

    const clsTarjeta = [
      styles.tarjeta,
      reserva.estado === 'pendiente' ? styles.tarjetaPendiente : '',
      reserva.estado === 'cancelada' ? styles.tarjetaCancelada : '',
    ].filter(Boolean).join(' ')

    return (
      <li key={reserva.id} className={clsTarjeta}>

        {/* Estado */}
        <div className={styles.estadoFila}>
          <span className={styles.punto} style={{ color: cfg.color }} aria-hidden="true" />
          <span className={styles.estadoLabel} style={{ color: cfg.color }}>{cfg.label}</span>
        </div>

        {/* Prenda + talla */}
        <p className={styles.prendaFila}>
          {reserva.prenda.nombre}
          {' '}
          <span className={styles.talla}>· {reserva.talla}</span>
        </p>

        {/* Cliente */}
        <p className={styles.clienteNombre}>{reserva.cliente.nombre_completo}</p>

        {/* Teléfono + fecha */}
        <div className={styles.metaFila}>
          <a
            href={`tel:${reserva.cliente.telefono}`}
            className={styles.telLink}
          >
            {reserva.cliente.telefono}
          </a>
          <span className={styles.fecha}>{formatFecha(reserva.creada_en)}</span>
        </div>

        {/* Error por ítem */}
        {errorEsta && (
          <p role="alert" className={styles.errorAccionItem}>{errorEsta}</p>
        )}

        {/* Acciones — según estado */}
        {enConfirm ? (
          <ConfirmInline
            msg={CONFIRM_CONFIG[confirmandoAccion].msg}
            labelSi={procesando ? '…' : CONFIRM_CONFIG[confirmandoAccion].btn}
            onNo={cancelarConfirm}
            onSi={() => ejecutarAccion(reserva, confirmandoAccion)}
            disabled={procesando}
            peligro={confirmandoAccion === 'cancelar'}
          />
        ) : reserva.estado === 'pendiente' ? (
          <div className={styles.acciones}>
            <CtaSecondary
              size="sm"
              disabled={procesandoId !== null}
              onClick={() => iniciarConfirm(reserva, 'atender')}
            >
              Atender
            </CtaSecondary>
            <CtaSecondary
              size="sm"
              danger
              disabled={procesandoId !== null}
              onClick={() => iniciarConfirm(reserva, 'cancelar')}
            >
              Cancelar
            </CtaSecondary>
          </div>
        ) : reserva.estado === 'atendida' ? (
          <div className={styles.acciones}>
            <CtaSecondary
              size="sm"
              disabled={procesandoId !== null}
              onClick={() => iniciarConfirm(reserva, 'desatender')}
            >
              Desatender
            </CtaSecondary>
          </div>
        ) : null}

      </li>
    )
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <div className={styles.cabecera}>
        <h2 className={styles.titulo}>Reservas</h2>
      </div>

      {reservas.length === 0 && (
        <div className={styles.estadoVacio}>
          <p>Aún no hay reservas.</p>
          <p>Cuando un cliente reserve una prenda, aparecerá aquí.</p>
        </div>
      )}

      {pendientes.length > 0 && (
        <div className={styles.nivelGroup}>
          <p className={styles.nivelLabel}>Pendientes ({pendientes.length})</p>
          <ul className={styles.lista}>
            {pendientes.map(renderTarjeta)}
          </ul>
        </div>
      )}

      {atendidas.length > 0 && (
        <div className={styles.nivelGroup}>
          <p className={styles.nivelLabel}>Atendidas ({atendidas.length})</p>
          <ul className={styles.lista}>
            {atendidas.map(renderTarjeta)}
          </ul>
        </div>
      )}

      {canceladas.length > 0 && (
        <div className={styles.nivelGroup}>
          <p className={styles.nivelLabel}>Canceladas ({canceladas.length})</p>
          <ul className={styles.lista}>
            {canceladas.map(renderTarjeta)}
          </ul>
        </div>
      )}
    </div>
    </AnimatedContent>
  )
}
