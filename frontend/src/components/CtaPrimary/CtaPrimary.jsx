import { useLedVisible } from '../../hooks/useLedVisible.js'
import styles from './CtaPrimary.module.css'

/**
 * Botón CTA principal con luz que recorre el borde en reposo.
 *
 * Técnica: pseudo-elemento ::before con conic-gradient animado vía @property
 * --border-angle. Una máscara CSS deja visible solo el borde (1px), no el interior.
 *
 * Pausa automática fuera de viewport (useLedVisible / IntersectionObserver):
 * evita que el shader de conic-gradient caliente cuando el botón no se ve.
 *
 * Restricciones (ver DESIGN.md §11 y plan aprobado):
 *   - Solo UN CTA principal por vista.
 *   - NO usar en el camino crítico de reserva (pantallas de reservar cita/prenda).
 *   - Los demás botones usan CtaSecondary (borde estático; solo hover/focus enciende).
 *
 * Fallback @property (Safari <15.4 / Firefox <128): borde verde estático. Legible.
 *
 * Props:
 *   children  — texto del botón
 *   onClick   — handler
 *   type      — "button" | "submit" (default "button")
 *   disabled  — bool
 */
export default function CtaPrimary({ children, onClick, type = 'button', disabled = false }) {
  const [ref, isVisible] = useLedVisible()

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.cta} ${!isVisible ? styles['cta--paused'] : ''}`}
    >
      {/* ::before con conic-gradient vive en CSS; pausa via clase */}
      <span className={styles.label}>{children}</span>
    </button>
  )
}
