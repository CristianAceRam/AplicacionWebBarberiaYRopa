export function ahoraMadridISO() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

export const ESTADO = {
  RESERVADA:  'Reservada',
  REALIZADA:  'Realizada',
  NO_ASISTIO: 'No asistió',
  CANCELADA:  'Cancelada',
}

// ahoraISO inyectable para tests sin tiempo real
export function estadoDerivado(cita, ahoraISO = ahoraMadridISO()) {
  if (cita.estado === 'no_asistida') return ESTADO.NO_ASISTIO
  if (cita.estado === 'cancelada')   return ESTADO.CANCELADA
  // Usa hora_inicio — alineado con el check es_pasada del backend (hora_inicio <= ahora → pasada)
  const citaInicio = `${cita.fecha}T${cita.hora_inicio.slice(0, 5)}`
  return citaInicio > ahoraISO ? ESTADO.RESERVADA : ESTADO.REALIZADA
}

export function esCancelable(cita, ahoraISO = ahoraMadridISO()) {
  return estadoDerivado(cita, ahoraISO) === ESTADO.RESERVADA
}
