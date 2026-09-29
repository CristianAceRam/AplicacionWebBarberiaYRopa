import styles from './CtaSecondary.module.css'

/**
 * Botón secundario. Borde estático en reposo — solo hover/focus enciende.
 * Contrasta con CtaPrimary (borde animado) y se usa para acciones secundarias.
 *
 * Props:
 *   children  — texto
 *   onClick   — handler
 *   type      — "button" | "submit" (default "button")
 *   disabled  — bool
 *   danger    — bool — variante destructiva (borde/texto en --error)
 *   size      — "md" | "sm" (default "md")
 */
export default function CtaSecondary({
  children,
  onClick,
  type = 'button',
  disabled = false,
  danger = false,
  size = 'md',
}) {
  const cls = [
    styles.btn,
    danger ? styles.danger : '',
    size === 'sm' ? styles.sm : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  )
}
