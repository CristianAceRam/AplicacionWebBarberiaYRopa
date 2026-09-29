import { useState, useEffect, useMemo } from 'react'
import LogoWordmark from '../../assets/nombresvg.svg?react'
import LogoSymbol   from '../../assets/logoPistia.svg?react'
import MetallicWordmark from './MetallicWordmark.jsx'
import { useLedVisible } from '../../hooks/useLedVisible.js'
import styles from './Logo.module.css'

/**
 * Logo de πίστη en dos variantes con roles distintos (DESIGN.md §1, §3, §5).
 *
 * Props:
 *   variant="wordmark" | "symbol"  — obligatorio; sin default para forzar elección explícita
 *   size="sm" | "md" | "lg"        — opcional, default "md"
 *   staticMode={bool}              — fuerza fallback SVG sin shader (A/B en Android, emergencia)
 *
 * Variantes:
 *   wordmark  → lettering graffiti πίστη completo (nombresvg.svg). Pieza de hero.
 *               USO RESTRINGIDO: solo escaparate (hub arriba, y login cuando exista).
 *               Shader metálico WebGL activo si: !staticMode && !prefersReducedMotion.
 *               isVisible pausa el shader fuera de viewport + visibilitychange + blur/focus.
 *               Fallback automático si WebGL falla, shader no compila o textura no carga.
 *
 *   symbol    → símbolo π compacto (logoPistia.svg). Marca de servicio funcional.
 *               Uso: cabeceras de BarberiaShell / TiendaShell, favicon/loaders si aplica.
 *               Glow base siempre; sin intensificación dinámica. Sin shader nunca (§10).
 */
export default function Logo({ variant, size = 'md', staticMode = false }) {
  const [ref, isVisible] = useLedVisible()

  // prefers-reduced-motion: evaluado en mount y reactivo en caliente (apagar → on).
  // Si el usuario activa reduced-motion con la app abierta, el shader se apaga sin recargar.
  const mql = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const [prefersReducedMotion, setPRM] = useState(mql.matches)
  useEffect(() => {
    const handler = (e) => { if (e.matches) setPRM(true) }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [mql])

  // Fallback automático si WebGL falla en cualquier eslabón de la cadena de setup
  const [shaderFailed, setShaderFailed] = useState(false)

  const showShader = variant === 'wordmark' && !staticMode && !prefersReducedMotion && !shaderFailed
  const intensify  = variant === 'wordmark' && isVisible

  return (
    <span
      ref={ref}
      className={[
        styles.logo,
        styles[`logo--${variant}`],
        styles[`logo--${size}`],
        intensify ? styles['logo--visible'] : '',
      ].filter(Boolean).join(' ')}
      role="img"
      aria-label="πίστη"
    >
      {variant === 'wordmark' ? (
        <>
          {/* SVG siempre en DOM: da tamaño al span inline-flex.
              opacity:0 cuando el shader está activo (canvas lo cubre).
              El drop-shadow del padre no procesa píxeles transparentes → sin sombra doble. */}
          <LogoWordmark
            aria-hidden="true"
            focusable="false"
            style={showShader ? { opacity: 0 } : undefined}
          />
          {showShader && (
            <MetallicWordmark
              isVisible={isVisible}
              onFallback={() => setShaderFailed(true)}
              className={styles.canvasOverlay}
            />
          )}
        </>
      ) : (
        <LogoSymbol aria-hidden="true" focusable="false" />
      )}
    </span>
  )
}
