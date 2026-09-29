import { useRef, useEffect } from 'react'
import styles from './Nav.module.css'

/**
 * Nav LED translúcido — panel que viaja con el indicador activo.
 *
 * Mobile (≤767px): barra inferior. Desktop (≥768px): columna lateral izquierda.
 *
 * El indicador activo es un único elemento .indicator que se desplaza
 * con transform (GPU-composited). Nunca hay border-bottom ni text-decoration
 * en los ítems: la luz ES el indicador.
 *
 * --nav-count se pasa como inline style en el contenedor para que
 * width: calc(100% / var(--nav-count)) en .indicator no tenga ningún
 * valor hardcodeado en el CSS.
 *
 * Plan A (cristal): class .glass — backdrop-filter: blur.
 * Plan B (sólido): default — sin backdrop-filter.
 * La clase .glass se activa solo si los tests en Android confirman que
 * el blur no produce jank. Por defecto: Plan B.
 *
 * Props:
 *   items    — array de { id, label, icon? }
 *   activeId — id del ítem activo
 *   onSelect — fn(id)
 *   glass    — bool, activa Plan A (default false)
 */
export default function Nav({ items = [], activeId, onSelect, glass = false }) {
  const indicatorRef = useRef(null)
  const itemRefs     = useRef([])
  const activeIndex  = items.findIndex((it) => it.id === activeId)

  /* Mueve el indicador al ítem activo.
     Móvil: translateX por índice (ítems equiancho con flex:1 → 100% = 1 slot).
     Desktop: mide offsetTop + offsetHeight reales de cada botón — necesario porque
     los ítems tienen flex:none (no llenan el nav) y pueden tener alturas distintas
     (p.ej. "MIS RESERVAS" ocupa 2 líneas). */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')

    function move() {
      const el = indicatorRef.current
      if (!el || activeIndex < 0) return

      if (mq.matches) {
        const activeItem = itemRefs.current[activeIndex]
        if (!activeItem) return
        el.style.height    = `${activeItem.offsetHeight}px`
        el.style.transform = `translateY(${activeItem.offsetTop}px)`
      } else {
        el.style.height    = ''
        el.style.transform = `translateX(${activeIndex * 100}%)`
      }
    }

    move()
    mq.addEventListener('change', move)
    window.addEventListener('resize', move)
    return () => {
      mq.removeEventListener('change', move)
      window.removeEventListener('resize', move)
    }
  }, [activeIndex])

  return (
    <nav
      className={`${styles.nav} ${glass ? styles['nav--glass'] : ''}`}
      style={{ '--nav-count': items.length }}
      aria-label="Navegación principal"
    >
      {/* Indicador viajero — luz que se desplaza al ítem activo */}
      <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />

      {items.map((item, i) => (
        <button
          key={item.id}
          ref={el => { itemRefs.current[i] = el }}
          className={`${styles.item} ${item.id === activeId ? styles['item--active'] : ''}`}
          onClick={() => onSelect?.(item.id)}
          aria-current={item.id === activeId ? 'page' : undefined}
        >
          {item.icon && (
            <span className={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
