import { useState, useEffect } from 'react'
import styles from './CalendarioMes.module.css'

// ── Localización ──────────────────────────────────────────────────────────────

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]
const DIAS_SEMANA = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
const DIAS_CORTOS = ['L','M','X','J','V','S','D']

// ── Helpers puros (getters locales — anti-bug UTC) ────────────────────────────

function formatDateISO(d) {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMesAnio(d) {
  const mes = MESES[d.getMonth()]
  return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${d.getFullYear()}`
}

function diaLabel(d) {
  const wd = (d.getDay() + 6) % 7
  return `${d.getDate()} de ${MESES[d.getMonth()]}, ${DIAS_SEMANA[wd]}`
}

function generarDiasMes(mes) {
  const y = mes.getFullYear()
  const m = mes.getMonth()
  const primerDia = new Date(y, m, 1)
  const diasEnMes = new Date(y, m + 1, 0).getDate()
  const primerWd  = (primerDia.getDay() + 6) % 7

  const dias = []
  for (let i = primerWd - 1; i >= 0; i--) {
    dias.push({ fecha: new Date(y, m, -i), delMes: false })
  }
  for (let d = 1; d <= diasEnMes; d++) {
    dias.push({ fecha: new Date(y, m, d), delMes: true })
  }
  while (dias.length % 7 !== 0) {
    const last = dias[dias.length - 1].fecha
    dias.push({
      fecha: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      delMes: false,
    })
  }
  return dias
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function CalendarioMes({
  fechaSeleccionada,
  onSeleccionar,
  esDeshabilitado = () => false,
  conPuntoVerde   = () => false,
  minFecha,
  maxFecha,
}) {
  const [mes, setMes] = useState(() => {
    if (!fechaSeleccionada) return new Date()
    const [y, m] = fechaSeleccionada.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })

  // Sincronizar mes cuando fechaSeleccionada cambia externamente (p.ej. flechas del padre)
  useEffect(() => {
    if (!fechaSeleccionada) { setMes(new Date()); return }
    const [y, m] = fechaSeleccionada.split('-').map(Number)
    setMes(prev => {
      const target = new Date(y, m - 1, 1)
      if (
        prev.getFullYear() === target.getFullYear() &&
        prev.getMonth()    === target.getMonth()
      ) return prev
      return target
    })
  }, [fechaSeleccionada])

  const hoyStr = formatDateISO(new Date())

  const lastDayPrevMes = new Date(mes.getFullYear(), mes.getMonth(), 0)
  const puedePrev = !minFecha || formatDateISO(lastDayPrevMes) >= minFecha
  const firstDayNextMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1)
  const puedeNext = !maxFecha || formatDateISO(firstDayNextMes) <= maxFecha
  const dias = generarDiasMes(mes)

  return (
    <div className={styles.calendario}>
      <div className={styles.calHeader}>
        <button
          className={styles.calNavBtn}
          onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          disabled={!puedePrev}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className={styles.calMesLabel}>{formatMesAnio(mes)}</span>
        <button
          className={styles.calNavBtn}
          onClick={() => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          disabled={!puedeNext}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className={styles.calGrid} role="grid" aria-label={`Calendario de ${formatMesAnio(mes)}`}>
        {DIAS_CORTOS.map(d => (
          <span key={d} className={styles.calDiaHeader} aria-hidden="true">{d}</span>
        ))}
        {dias.map(({ fecha, delMes }) => {
          if (!delMes) {
            return (
              <span
                key={`out-${formatDateISO(fecha)}`}
                className={styles.calDiaFuera}
                aria-hidden="true"
              />
            )
          }
          const str        = formatDateISO(fecha)
          const disponible = !esDeshabilitado(str)
          const puntoVerde = conPuntoVerde(str)
          const esHoy      = str === hoyStr
          const seleccionado = str === fechaSeleccionada
          return (
            <button
              key={str}
              role="gridcell"
              className={[
                styles.calDia,
                !disponible  ? styles.calDiaDeshabilitado : '',
                esHoy        ? styles.calDiaHoy           : '',
                seleccionado ? styles.calDiaSeleccionado  : '',
              ].filter(Boolean).join(' ')}
              disabled={!disponible}
              aria-pressed={seleccionado || undefined}
              aria-label={diaLabel(fecha)}
              onClick={() => onSeleccionar(str)}
            >
              {fecha.getDate()}
              {puntoVerde && disponible && (
                <span className={styles.puntoApertura} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
