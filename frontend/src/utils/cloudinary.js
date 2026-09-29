export function cloudinaryUrl(url, { width = 400 } = {}) {
  if (!url) return url  // fallback seguro: nunca cadena vacía → nunca imagen rota
  const MARKER = '/image/upload/'
  const idx = url.indexOf(MARKER)
  if (idx === -1) return url  // URL no reconocida → devolver tal cual

  const base = url.slice(0, idx + MARKER.length)
  const rest = url.slice(idx + MARKER.length)

  // Si el segmento inmediato ya trae f_ o q_, no duplicar — solo añadir el width
  const firstSeg = rest.split('/')[0]
  const hasFormatQuality = firstSeg.includes('f_') || firstSeg.includes('q_')

  const prefix = hasFormatQuality ? `w_${width}/` : `w_${width},f_auto,q_auto/`
  return base + prefix + rest
}
