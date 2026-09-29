import { useState, useRef } from 'react'
import { cloudinaryUrl } from '../../utils/cloudinary.js'
import styles from './Carousel.module.css'

export default function Carousel({ imagenes, nombre }) {
  const sorted = [...imagenes].sort((a, b) => a.posicion - b.posicion)
  const [currentIdx, setCurrentIdx] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(dx) < Math.abs(dy)) return
    if (Math.abs(dx) < 50) return
    if (dx < 0) setCurrentIdx(i => Math.min(sorted.length - 1, i + 1))
    else        setCurrentIdx(i => Math.max(0, i - 1))
  }

  if (sorted.length === 0) {
    return (
      <div className={styles.fallback} aria-hidden="true">
        <span className={styles.piSym}>π</span>
      </div>
    )
  }

  return (
    <div
      className={styles.wrap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={`Fotos de ${nombre}`}
    >
      <div
        className={styles.track}
        style={{ transform: `translateX(-${currentIdx * 100}%)` }}
      >
        {sorted.map((img, i) => (
          <div key={img.id} className={styles.slide} aria-hidden={i !== currentIdx}>
            <img
              src={cloudinaryUrl(img.url, { width: 800 })}
              alt={i === 0 ? nombre : `${nombre} — foto ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={styles.img}
              onError={(e) => { e.currentTarget.src = img.url }}
            />
          </div>
        ))}
      </div>

      {sorted.length > 1 && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowPrev}`}
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            aria-label="Foto anterior"
            disabled={currentIdx === 0}
          >
            ‹
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowNext}`}
            onClick={() => setCurrentIdx(i => Math.min(sorted.length - 1, i + 1))}
            aria-label="Foto siguiente"
            disabled={currentIdx === sorted.length - 1}
          >
            ›
          </button>

          <div className={styles.dots} role="tablist" aria-label="Fotos">
            {sorted.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === currentIdx}
                aria-label={`Foto ${i + 1}`}
                className={`${styles.dot} ${i === currentIdx ? styles.dotActive : ''}`}
                onClick={() => setCurrentIdx(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
