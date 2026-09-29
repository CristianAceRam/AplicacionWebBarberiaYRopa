import { useEffect, useRef, useState } from 'react'

/**
 * Devuelve [ref, isVisible].
 * Adjunta ref al elemento; isVisible = true cuando entra en viewport.
 * Usado por Logo y CtaPrimary para pausar animaciones costosas
 * cuando el componente no está visible (animation-play-state: paused).
 *
 * Preparado para el Metallic Paint WebGL diferido (Fase 4):
 * cuando llegue el shader, solo hay que reaccionar al isVisible devuelto.
 */
export function useLedVisible(options = {}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1, ...options },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, isVisible]
}
