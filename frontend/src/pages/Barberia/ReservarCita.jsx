import { useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ApiError } from '../../api/api.js'
import { useServicios } from '../../hooks/useServicios.js'
import { useCalendario } from '../../hooks/useCalendario.js'
import EstadoCargando from '../../components/ui/EstadoCargando.jsx'
import CalendarioMes from '../../components/CalendarioMes/CalendarioMes.jsx'
import styles from './ReservarCita.module.css'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'

// ── Helpers puros ──────────────────────────────────────────────────────────

function formatDateISO(d) {
  // Usa campos locales para evitar el offset UTC de toISOString()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatFechaLarga(d) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d)
}

function formatPrecio(p) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
  }).format(Number(p))
}

function parseDateISO(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isDiaDisponible(d, hoyStr, limiteStr, cierres, aperturas, diasSemanaAbiertos) {
  const str = formatDateISO(d)
  if (str < hoyStr || str > limiteStr) return false
  if (cierres.has(str)) return false
  const wd = (d.getDay() + 6) % 7  // 0=Lun…6=Dom (mismo que Python weekday)
  return diasSemanaAbiertos.has(wd) || aperturas.has(str)
}

// ── Subcomponente: indicador de pasos ─────────────────────────────────────

function IndicadorPasos({ paso }) {
  const STEPS = [1, 2, 3, 4]
  return (
    <div className={styles.indicador} aria-hidden="true">
      {STEPS.map((n, i) => (
        <Fragment key={n}>
          <div
            className={[
              styles.stepNodo,
              paso === n ? styles.stepNodoActivo : '',
              paso > n  ? styles.stepNodoCompleto : '',
            ].filter(Boolean).join(' ')}
          >
            {paso > n ? '✓' : n}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={[
                styles.stepConector,
                paso > n ? styles.stepConectorActivo : '',
              ].filter(Boolean).join(' ')}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

// ── Helpers de className ───────────────────────────────────────────────────

function badgeCls(n, paso, styles) {
  return [
    styles.stepBadge,
    paso === n ? styles.stepBadgeActivo : '',
    paso > n  ? styles.stepBadgeCompleto : '',
  ].filter(Boolean).join(' ')
}

// ── Componente principal ───────────────────────────────────────────────────

export default function ReservarCita() {
  const { fetchWithAuth } = useAuth()
  const {
    servicios,
    cargando: servCargando,
    error: servError,
    recargar: recargarServ,
  } = useServicios()
  const {
    diasSemanaAbiertos, cierres, aperturas,
    cargando: calCargando,
    error: calError,
    recargar: recargarCal,
  } = useCalendario()

  const [paso, setPaso] = useState(1)
  const [servicioSel, setServicioSel] = useState(null)
  const [fechaSel, setFechaSel] = useState(null)
  const [horasDisponibles, setHorasDisponibles] = useState([])
  const [dispCargando, setDispCargando] = useState(false)
  const [dispError, setDispError] = useState(null)
  const [horaSel, setHoraSel] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [errorCita, setErrorCita] = useState(null)
  const [citaConfirmada, setCitaConfirmada] = useState(null)

  // ── Calendario: valores derivados ───────────────────────────────────────

  const hoy = new Date()
  const hoyStr = formatDateISO(hoy)
  const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30)
  const limiteStr = formatDateISO(limite)

  // ── Handlers ────────────────────────────────────────────────────────────

  async function fetchDisponibilidad(fecha, servicioId, { silencioso = false } = {}) {
    if (!silencioso) {
      setDispCargando(true)
      setDispError(null)
      setHorasDisponibles([])
    }
    try {
      const data = await fetchWithAuth(
        `/disponibilidad?fecha=${formatDateISO(fecha)}&servicio_id=${servicioId}`
      )
      setHorasDisponibles(data.horas_disponibles)
    } catch {
      if (!silencioso) setDispError('error')
    } finally {
      if (!silencioso) setDispCargando(false)
    }
  }

  function elegirServicio(s) {
    setServicioSel(s)
    setFechaSel(null)
    setHoraSel(null)
    setHorasDisponibles([])
    setDispCargando(false)
    setDispError(null)
    setErrorCita(null)
    setPaso(2)
  }

  function elegirFecha(d) {
    setFechaSel(d)
    setHoraSel(null)
    setDispError(null)
    setErrorCita(null)
    setPaso(3)
    fetchDisponibilidad(d, servicioSel.id)
  }

  function elegirHora(h) {
    setHoraSel(h)
    setErrorCita(null)
    setPaso(4)
  }

  function volverPaso() {
    if (paso === 2) {
      setFechaSel(null)
      setHoraSel(null)
      setHorasDisponibles([])
      setDispCargando(false)
      setDispError(null)
      setErrorCita(null)
      setPaso(1)
    } else if (paso === 3) {
      setHoraSel(null)
      setHorasDisponibles([])
      setDispCargando(false)
      setDispError(null)
      setErrorCita(null)
      setPaso(2)
    } else if (paso === 4) {
      setHoraSel(null)
      setErrorCita(null)
      setPaso(3)
    }
  }

  function resetear() {
    setPaso(1)
    setServicioSel(null)
    setFechaSel(null)
    setHorasDisponibles([])
    setDispCargando(false)
    setDispError(null)
    setHoraSel(null)
    setEnviando(false)
    setErrorCita(null)
    setCitaConfirmada(null)
  }

  async function handleConfirmar() {
    setEnviando(true)
    setErrorCita(null)
    try {
      const cita = await fetchWithAuth('/citas', {
        method: 'POST',
        body: {
          servicio_id: servicioSel.id,
          fecha: formatDateISO(fechaSel),
          hora_inicio: horaSel,
        },
      })
      setCitaConfirmada({
        nombre: servicioSel.nombre,
        duracion_minutos: servicioSel.duracion_minutos,
        precio: servicioSel.precio,
        fecha: fechaSel,
        hora: horaSel,
        hora_fin: cita.hora_fin,
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Caso estrella: hueco ocupado en concurrencia → recarga silenciosa + vuelve a paso 3
          setErrorCita('Ese hueco se acaba de ocupar. Elige otro.')
          setHoraSel(null)
          setPaso(3)
          fetchDisponibilidad(fechaSel, servicioSel.id, { silencioso: true })
        } else if (err.status === 422) {
          setErrorCita('Ese hueco ya no está disponible. Elige de nuevo.')
          setHoraSel(null)
          setPaso(3)
          fetchDisponibilidad(fechaSel, servicioSel.id, { silencioso: true })
        } else if (err.status === 403) {
          setErrorCita('Tu cuenta está bloqueada. Contacta con la barbería.')
        } else {
          setErrorCita('No se pudo reservar. Inténtalo de nuevo.')
        }
      } else {
        setErrorCita('No se pudo reservar. Inténtalo de nuevo.')
      }
    } finally {
      setEnviando(false)
    }
  }

  // ── Estado de carga inicial ──────────────────────────────────────────────

  if (servCargando || calCargando) return <EstadoCargando />

  if (servError || calError) {
    return (
      <AnimatedContent>
      <div role="alert" className={styles.errorPagina}>
        <p className={styles.errorPaginaMsg}>No se pudo cargar la información.</p>
        <button
          className={styles.btnReintentar}
          onClick={() => { recargarServ(); recargarCal() }}
        >
          Reintentar
        </button>
      </div>
      </AnimatedContent>
    )
  }

  // ── Estado de éxito ──────────────────────────────────────────────────────

  if (citaConfirmada) {
    return (
      <AnimatedContent>
      <div className={styles.exito}>
        <p className={styles.exitoTitulo}>Cita reservada</p>
        <div className={styles.exitoDetalle}>
          <p className={styles.exitoServicio}>{citaConfirmada.nombre}</p>
          <p className={styles.exitoFechaHora}>
            {formatFechaLarga(citaConfirmada.fecha)} · {citaConfirmada.hora.slice(0, 5)}
          </p>
          <p className={styles.exitoDuracion}>
            {citaConfirmada.duracion_minutos} min · {formatPrecio(citaConfirmada.precio)}
          </p>
        </div>
        <div className={styles.exitoAcciones}>
          <Link to="/barberia/citas" className={styles.linkCitas}>Ver mis citas</Link>
          <button onClick={resetear} className={styles.btnNueva}>Nueva reserva</button>
        </div>
      </div>
      </AnimatedContent>
    )
  }

  // ── Render principal ─────────────────────────────────────────────────────

  return (
    <AnimatedContent>
    <div className={styles.pagina}>
      <IndicadorPasos paso={paso} />

      {/* ── Paso 1: Servicio ── */}
      <section
        className={[styles.stepSec, paso === 1 ? styles.stepSecActivo : ''].filter(Boolean).join(' ')}
        aria-label="Paso 1: Servicio"
      >
        <h2 className={styles.stepTitulo}>
          <span className={badgeCls(1, paso, styles)}>
            {paso > 1 ? '✓' : '1'}
          </span>
          Servicio
        </h2>
        {servicios.length === 0 ? (
          <p className={styles.sinHuecos}>No hay servicios disponibles.</p>
        ) : (
          <ul className={styles.serviciosLista}>
            {servicios.map(s => (
              <li key={s.id}>
                <button
                  className={[
                    styles.servicioCard,
                    servicioSel?.id === s.id ? styles.servicioSeleccionado : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => elegirServicio(s)}
                  aria-pressed={servicioSel?.id === s.id}
                >
                  <span className={styles.servicioNombre}>{s.nombre}</span>
                  <span className={styles.servicioMeta}>
                    <span className={styles.servicioDuracion}>{s.duracion_minutos} min</span>
                    <span className={styles.servicioPrecio}>{formatPrecio(s.precio)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Paso 2: Fecha ── */}
      <section
        className={[
          styles.stepSec,
          paso >= 2 ? styles.stepActivo : styles.stepOculto,
          paso === 2 ? styles.stepSecActivo : '',
        ].filter(Boolean).join(' ')}
        aria-label="Paso 2: Fecha"
      >
        <h2 className={styles.stepTitulo}>
          <span className={badgeCls(2, paso, styles)}>
            {paso > 2 ? '✓' : '2'}
          </span>
          Fecha
        </h2>
        {paso === 2 && (
          <button type="button" className={styles.btnAtras} onClick={volverPaso}>
            ← Atrás
          </button>
        )}

        <CalendarioMes
          fechaSeleccionada={fechaSel ? formatDateISO(fechaSel) : null}
          onSeleccionar={(str) => elegirFecha(parseDateISO(str))}
          esDeshabilitado={(str) => !isDiaDisponible(
            parseDateISO(str), hoyStr, limiteStr, cierres, aperturas, diasSemanaAbiertos
          )}
          conPuntoVerde={(str) => aperturas.has(str)}
          minFecha={hoyStr}
          maxFecha={limiteStr}
        />
      </section>

      {/* ── Paso 3: Hora ── */}
      <section
        className={[
          styles.stepSec,
          paso >= 3 ? styles.stepActivo : styles.stepOculto,
          paso === 3 ? styles.stepSecActivo : '',
        ].filter(Boolean).join(' ')}
        aria-label="Paso 3: Hora"
      >
        <h2 className={styles.stepTitulo}>
          <span className={badgeCls(3, paso, styles)}>
            {paso > 3 ? '✓' : '3'}
          </span>
          Hora
        </h2>
        {paso === 3 && (
          <button type="button" className={styles.btnAtras} onClick={volverPaso}>
            ← Atrás
          </button>
        )}
        {fechaSel && (
          <p className={styles.fechaLabel}>{formatFechaLarga(fechaSel)}</p>
        )}
        {errorCita && paso === 3 && (
          <p className={styles.errorCita} role="alert">{errorCita}</p>
        )}
        {dispCargando && <EstadoCargando mensaje="Comprobando disponibilidad…" />}
        {!dispCargando && dispError && (
          <div role="alert" className={styles.dispError}>
            <p>No se pudo cargar la disponibilidad.</p>
            <button
              className={styles.btnReintentarDisp}
              onClick={() => fechaSel && servicioSel && fetchDisponibilidad(fechaSel, servicioSel.id)}
            >
              Reintentar
            </button>
          </div>
        )}
        {!dispCargando && !dispError && horasDisponibles.length === 0 && paso >= 3 && (
          <p className={styles.sinHuecos}>
            No hay huecos disponibles ese día. Prueba otra fecha.
          </p>
        )}
        {!dispCargando && !dispError && horasDisponibles.length > 0 && (
          <div role="group" aria-label="Hora de la cita" className={styles.horasGrid}>
            {horasDisponibles.map(h => (
              <button
                key={h}
                className={[
                  styles.horaChip,
                  horaSel === h ? styles.horaSeleccionada : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={horaSel === h}
                onClick={() => elegirHora(h)}
              >
                {h.slice(0, 5)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Paso 4: Confirmar ── */}
      <section
        className={[
          styles.stepSec,
          paso >= 4 ? styles.stepActivo : styles.stepOculto,
          paso === 4 ? styles.stepSecActivo : '',
        ].filter(Boolean).join(' ')}
        aria-label="Paso 4: Confirmar"
      >
        <h2 className={styles.stepTitulo}>
          <span className={badgeCls(4, paso, styles)}>4</span>
          Confirmar
        </h2>
        {paso === 4 && (
          <button type="button" className={styles.btnAtras} onClick={volverPaso}>
            ← Atrás
          </button>
        )}
        {servicioSel && fechaSel && horaSel && (
          <>
            <dl className={styles.resumen}>
              <div className={styles.resumenFila}>
                <dt className={styles.resumenLabel}>Servicio</dt>
                <dd className={styles.resumenValor}>{servicioSel.nombre}</dd>
              </div>
              <div className={styles.resumenFila}>
                <dt className={styles.resumenLabel}>Duración</dt>
                <dd className={styles.resumenValorMono}>{servicioSel.duracion_minutos} min</dd>
              </div>
              <div className={styles.resumenFila}>
                <dt className={styles.resumenLabel}>Precio</dt>
                <dd className={styles.resumenValorMono}>{formatPrecio(servicioSel.precio)}</dd>
              </div>
              <div className={styles.resumenFila}>
                <dt className={styles.resumenLabel}>Fecha</dt>
                <dd className={styles.resumenValorMono}>{formatFechaLarga(fechaSel)}</dd>
              </div>
              <div className={styles.resumenFila}>
                <dt className={styles.resumenLabel}>Hora</dt>
                <dd className={styles.resumenValorMono}>{horaSel.slice(0, 5)}</dd>
              </div>
            </dl>
            {errorCita && paso === 4 && (
              <p className={styles.errorCita} role="alert">{errorCita}</p>
            )}
            <button
              className={styles.btnConfirmar}
              onClick={handleConfirmar}
              disabled={enviando}
            >
              {enviando ? 'Reservando…' : 'Confirmar cita'}
            </button>
          </>
        )}
      </section>
    </div>
    </AnimatedContent>
  )
}
