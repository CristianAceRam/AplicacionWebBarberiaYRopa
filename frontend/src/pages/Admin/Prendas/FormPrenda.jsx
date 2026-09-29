import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import { cloudinaryUrl } from '../../../utils/cloudinary.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './FormPrenda.module.css'

const CAMPO_VACIO = { nombre: '', descripcion: '', precio: '', categoria: '', activo: true }

const FOLDER_PRENDAS   = 'pistia/prendas'
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES        = 5_000_000
const MAX_IMAGENES     = 8

function datosIguales(a, b) {
  return (
    a.nombre      === b.nombre &&
    a.descripcion === b.descripcion &&
    a.precio      === b.precio &&
    a.categoria   === b.categoria &&
    a.activo      === b.activo
  )
}

// ── Sección de imágenes ────────────────────────────────────────────────────

function SeccionImagenes({ prendaId, imagenes, setImagenes, fetchWithAuth }) {
  const [subiendo,             setSubiendo]             = useState(false)
  const [errorSubida,          setErrorSubida]          = useState(null)
  const [reordenando,          setReordenando]          = useState(false)
  const [errorReorden,         setErrorReorden]         = useState(null)
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState(null)
  const [borrandoId,           setBorrandoId]           = useState(null)
  const [errorBorrado,         setErrorBorrado]         = useState({})

  const topeAlcanzado = imagenes.length >= MAX_IMAGENES
  // Todos los controles bloqueados mientras hay cualquier operación en vuelo.
  // Previene la carrera reorden↔borrado: si un reorden falla y revierte el
  // array, no puede haber un borrado concurrente con un id ya desaparecido.
  const ocupado = reordenando || borrandoId !== null

  // ── Subida ──────────────────────────────────────────────────────────────

  async function handleSubirImagen(e) {
    const fichero = e.target.files[0]
    e.target.value = ''
    if (!fichero) return

    if (!TIPOS_PERMITIDOS.includes(fichero.type)) {
      setErrorSubida('Solo se permiten imágenes JPEG, PNG o WebP.')
      return
    }
    if (fichero.size > MAX_BYTES) {
      setErrorSubida('El archivo supera el límite de 5 MB.')
      return
    }

    setSubiendo(true)
    setErrorSubida(null)

    let firma
    try {
      firma = await fetchWithAuth('/cloudinary/firma', {
        method: 'POST',
        body: { folder: FOLDER_PRENDAS },
      })
    } catch {
      setErrorSubida('No se pudo obtener la firma. Inténtalo de nuevo.')
      setSubiendo(false)
      return
    }

    const fd = new FormData()
    fd.append('file',            fichero)
    fd.append('api_key',         firma.api_key)
    fd.append('signature',       firma.signature)
    fd.append('timestamp',       String(firma.timestamp))
    fd.append('folder',          firma.folder)
    fd.append('allowed_formats', firma.allowed_formats)

    let cloudRes
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloud_name}/image/upload`,
        { method: 'POST', body: fd },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Error Cloudinary')
      }
      cloudRes = await res.json()
    } catch (err) {
      setErrorSubida(`Error al subir la imagen: ${err.message ?? 'Inténtalo de nuevo.'}`)
      setSubiendo(false)
      return
    }

    try {
      const nueva = await fetchWithAuth(`/prendas/${prendaId}/imagenes`, {
        method: 'POST',
        body: { url: cloudRes.secure_url, public_id: cloudRes.public_id },
      })
      setImagenes(prev => [...prev, nueva])
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409
        ? 'Máximo de imágenes alcanzado.'
        : 'No se pudo guardar la imagen.'
      setErrorSubida(msg)
    } finally {
      setSubiendo(false)
    }
  }

  // ── Reordenación (bulk, optimista) ──────────────────────────────────────

  async function handleReorden(nuevoOrden) {
    const prevImagenes = imagenes
    const reordenadas = nuevoOrden.map((img, i) => ({ ...img, posicion: i * 10 }))
    setImagenes(reordenadas)
    setReordenando(true)
    setErrorReorden(null)
    try {
      await fetchWithAuth(`/prendas/${prendaId}/imagenes/orden`, {
        method: 'PUT',
        body: reordenadas.map(img => ({ id: img.id, posicion: img.posicion })),
      })
    } catch {
      setImagenes(prevImagenes)
      setErrorReorden('No se pudo guardar el orden. Inténtalo de nuevo.')
    } finally {
      setReordenando(false)
    }
  }

  function handleSubir(img) {
    const idx = imagenes.findIndex(i => i.id === img.id)
    if (idx <= 0) return
    const nuevas = [...imagenes]
    ;[nuevas[idx - 1], nuevas[idx]] = [nuevas[idx], nuevas[idx - 1]]
    handleReorden(nuevas)
  }

  function handleBajar(img) {
    const idx = imagenes.findIndex(i => i.id === img.id)
    if (idx >= imagenes.length - 1) return
    const nuevas = [...imagenes]
    ;[nuevas[idx], nuevas[idx + 1]] = [nuevas[idx + 1], nuevas[idx]]
    handleReorden(nuevas)
  }

  function handleHacerPrincipal(img) {
    const idx = imagenes.findIndex(i => i.id === img.id)
    if (idx === 0) return
    handleReorden([imagenes[idx], ...imagenes.filter((_, i) => i !== idx)])
  }

  // ── Borrado (dos pasos) ──────────────────────────────────────────────────

  async function handleBorrar(img) {
    setBorrandoId(img.id)
    setErrorBorrado(prev => { const n = { ...prev }; delete n[img.id]; return n })
    try {
      await fetchWithAuth(`/prendas/${prendaId}/imagenes/${img.id}`, { method: 'DELETE' })
      setImagenes(prev => prev.filter(i => i.id !== img.id))
      setConfirmandoBorradoId(null)
    } catch {
      setErrorBorrado(prev => ({ ...prev, [img.id]: 'No se pudo borrar.' }))
    } finally {
      setBorrandoId(null)
    }
  }

  function handleCancelarBorrado(img) {
    setConfirmandoBorradoId(null)
    setErrorBorrado(prev => { const n = { ...prev }; delete n[img.id]; return n })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className={styles.seccionImagenes}>
      <p className={styles.seccionLabel}>Imágenes</p>

      {!imagenes.length && (
        <p className={styles.imagenesVacio}>Sin imágenes todavía.</p>
      )}

      {errorReorden && (
        <p role="alert" className={styles.errorReorden}>{errorReorden}</p>
      )}

      {imagenes.length > 0 && (
        <div className={styles.imagenesGrid}>
          {imagenes.map((img, idx) => (
            <div key={img.id} className={styles.imagenItem}>
              <div className={styles.imagenThumb}>
                <img
                  src={cloudinaryUrl(img.url, { width: 240 })}
                  alt=""
                  onError={e => {
                    if (e.currentTarget.dataset.fallback) return
                    e.currentTarget.dataset.fallback = '1'
                    e.currentTarget.src = img.url
                  }}
                  className={styles.imagenMiniatura}
                />
              </div>

              {confirmandoBorradoId === img.id ? (
                <div className={styles.confirmPanel}>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnCancelarBorrar}`}
                    onClick={() => handleCancelarBorrado(img)}
                    disabled={borrandoId === img.id}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnConfirmarBorrar}`}
                    onClick={() => handleBorrar(img)}
                    disabled={borrandoId === img.id}
                  >
                    {borrandoId === img.id ? '…' : 'Borrar'}
                  </button>
                </div>
              ) : (
                <div className={styles.imagenControles}>
                  <button
                    type="button"
                    className={styles.btnControl}
                    onClick={() => handleSubir(img)}
                    disabled={ocupado || idx === 0}
                    aria-label="Subir imagen"
                    title="Subir"
                  >↑</button>
                  <button
                    type="button"
                    className={styles.btnControl}
                    onClick={() => handleBajar(img)}
                    disabled={ocupado || idx === imagenes.length - 1}
                    aria-label="Bajar imagen"
                    title="Bajar"
                  >↓</button>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnPrincipal}`}
                    onClick={() => handleHacerPrincipal(img)}
                    disabled={ocupado || idx === 0}
                    aria-label="Hacer imagen principal"
                    title="Portada"
                  >★</button>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnBorrar}`}
                    onClick={() => setConfirmandoBorradoId(img.id)}
                    disabled={ocupado}
                    aria-label="Borrar imagen"
                    title="Borrar"
                  >✕</button>
                </div>
              )}

              {errorBorrado[img.id] && (
                <p role="alert" className={styles.errorBorradoItem}>{errorBorrado[img.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {topeAlcanzado && (
        <p className={styles.topeMsg}>Máximo {MAX_IMAGENES} imágenes por prenda.</p>
      )}

      <label className={`${styles.fileLabel} ${(subiendo || topeAlcanzado) ? styles.fileLabelDisabled : ''}`}>
        {subiendo && <span className={styles.ledIndicador} aria-hidden="true" />}
        {subiendo ? 'Subiendo…' : 'Subir imagen'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg"
          disabled={subiendo || topeAlcanzado}
          onChange={handleSubirImagen}
          className={styles.fileInput}
          aria-label="Subir imagen a la prenda"
        />
      </label>

      {errorSubida && (
        <p role="alert" className={styles.errorSubida}>{errorSubida}</p>
      )}
    </section>
  )
}

// ── Sección de tallas ──────────────────────────────────────────────────────

function SeccionTallas({ prendaId, tallas, setTallas, fetchWithAuth }) {
  const [nuevaTalla, setNuevaTalla]     = useState('')
  const [errorTalla, setErrorTalla]     = useState(null)
  const [añadiendo, setAñadiendo]       = useState(false)
  const [errorFilas, setErrorFilas]     = useState({})
  const [togglingId, setTogglingId]     = useState(null)
  const [quitandoId, setQuitandoId]     = useState(null)

  async function handleAñadir(e) {
    e.preventDefault()
    const talla = nuevaTalla.trim()
    if (!talla) { setErrorTalla('Introduce un nombre de talla.'); return }
    setAñadiendo(true); setErrorTalla(null)
    try {
      const nueva = await fetchWithAuth(`/prendas/${prendaId}/tallas`, {
        method: 'POST',
        body: { talla, disponible: true },
      })
      setTallas(prev => [...prev, nueva])
      setNuevaTalla('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrorTalla('Ya existe esa talla para esta prenda.')
      } else if (err instanceof ApiError && err.status === 422) {
        setErrorTalla('Nombre de talla no válido.')
      } else {
        setErrorTalla('No se pudo añadir. Inténtalo de nuevo.')
      }
    } finally {
      setAñadiendo(false)
    }
  }

  async function handleToggle(talla) {
    const nuevo = !talla.disponible
    setTallas(prev => prev.map(t => t.id === talla.id ? { ...t, disponible: nuevo } : t))
    setTogglingId(talla.id)
    try {
      await fetchWithAuth(`/prendas/${prendaId}/tallas/${talla.id}`, {
        method: 'PATCH',
        body: { disponible: nuevo },
      })
    } catch {
      setTallas(prev => prev.map(t => t.id === talla.id ? { ...t, disponible: talla.disponible } : t))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleQuitar(talla) {
    setQuitandoId(talla.id)
    setErrorFilas(prev => { const n = { ...prev }; delete n[talla.id]; return n })
    try {
      await fetchWithAuth(`/prendas/${prendaId}/tallas/${talla.id}`, { method: 'DELETE' })
      setTallas(prev => prev.filter(t => t.id !== talla.id))
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409
        ? 'Esta talla tiene reservas pendientes.'
        : 'No se pudo quitar. Inténtalo de nuevo.'
      setErrorFilas(prev => ({ ...prev, [talla.id]: msg }))
    } finally {
      setQuitandoId(null)
    }
  }

  return (
    <section className={styles.seccionTallas}>
      <p className={styles.seccionLabel}>Tallas</p>

      {tallas.length === 0 && (
        <p className={styles.tallasVacio}>Sin tallas todavía.</p>
      )}

      <ul className={styles.tallasList}>
        {tallas.map(talla => (
          <li key={talla.id} className={styles.tallaFila}>
            <div className={styles.tallaFilaMain}>
              <span className={styles.tallaNombre}>{talla.talla}</span>
              <span className={`${styles.tallaEstado} ${talla.disponible ? styles.tallaDisponible : styles.tallaAgotada}`}>
                {talla.disponible ? 'Disponible' : 'Agotada'}
              </span>
              <div className={styles.tallaAcciones}>
                <CtaSecondary
                  size="sm"
                  disabled={togglingId === talla.id}
                  onClick={() => handleToggle(talla)}
                >
                  {togglingId === talla.id ? '…' : talla.disponible ? 'Marcar agotada' : 'Marcar disponible'}
                </CtaSecondary>
                <CtaSecondary
                  size="sm"
                  danger
                  disabled={quitandoId === talla.id}
                  onClick={() => handleQuitar(talla)}
                >
                  {quitandoId === talla.id ? '…' : 'Quitar'}
                </CtaSecondary>
              </div>
            </div>
            {errorFilas[talla.id] && (
              <p role="alert" className={styles.tallaError}>{errorFilas[talla.id]}</p>
            )}
          </li>
        ))}
      </ul>

      <form className={styles.añadirFila} onSubmit={handleAñadir} noValidate>
        <div className={styles.añadirInputWrap}>
          <input
            type="text"
            value={nuevaTalla}
            onChange={e => { setNuevaTalla(e.target.value); setErrorTalla(null) }}
            placeholder="S / M / XL / Única…"
            className={`${styles.input} ${errorTalla ? styles.inputError : ''}`}
            aria-label="Nueva talla"
            maxLength={20}
          />
          {errorTalla && <span role="alert" className={styles.fieldError}>{errorTalla}</span>}
        </div>
        <CtaSecondary type="submit" size="sm" disabled={añadiendo}>
          {añadiendo ? '…' : 'Añadir'}
        </CtaSecondary>
      </form>
    </section>
  )
}

// ── FormPrenda ─────────────────────────────────────────────────────────────

export default function FormPrenda() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { prendaId } = useParams()
  const modoEditar = !!prendaId
  const { fetchWithAuth } = useAuth()

  const [campos, setCampos]       = useState(CAMPO_VACIO)
  const [original, setOriginal]   = useState(CAMPO_VACIO)
  const [imagenes, setImagenes]   = useState([])
  const [tallas, setTallas]       = useState([])
  const [cargando, setCargando]   = useState(modoEditar)
  const [errores, setErrores]     = useState({})
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]         = useState(null)
  const [errorGeneral, setErrorGeneral] = useState(null)

  const recienCreada = location.state?.nueva === true

  useEffect(() => {
    if (!modoEditar) return
    let cancelado = false
    setCargando(true)
    fetchWithAuth(`/prendas/${prendaId}`)
      .then(data => {
        if (cancelado) return
        const c = {
          nombre:      data.nombre      ?? '',
          descripcion: data.descripcion ?? '',
          precio:      parseFloat(data.precio).toFixed(2),
          categoria:   data.categoria   ?? '',
          activo:      data.activo      ?? true,
        }
        setCampos(c)
        setOriginal(c)
        setImagenes(data.imagenes ?? [])
        setTallas(data.tallas ?? [])
        setCargando(false)
      })
      .catch(() => {
        if (!cancelado) setCargando(false)
      })
    return () => { cancelado = true }
  }, [prendaId, modoEditar]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <EstadoCargando mensaje="Cargando prenda…" />

  const sinCambios = modoEditar && datosIguales(campos, original)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    const nuevo = type === 'checkbox' ? checked : value
    setCampos(prev => ({ ...prev, [name]: nuevo }))
    setExito(null)
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: '' }))
  }

  function validar() {
    const errs = {}
    if (!campos.nombre.trim())         errs.nombre      = 'El nombre es obligatorio.'
    if (!campos.descripcion.trim())    errs.descripcion = 'La descripción es obligatoria.'
    const precio = parseFloat(campos.precio)
    if (isNaN(precio) || precio < 0)   errs.precio      = 'Introduce un precio válido (≥ 0).'
    if (campos.categoria.length > 100) errs.categoria   = 'Máximo 100 caracteres.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true); setErrorGeneral(null); setErrores({})

    const body = {
      nombre:      campos.nombre.trim(),
      descripcion: campos.descripcion.trim(),
      precio:      parseFloat(campos.precio),
      categoria:   campos.categoria.trim() || null,
    }
    if (modoEditar) body.activo = campos.activo

    try {
      if (modoEditar) {
        await fetchWithAuth(`/prendas/${prendaId}`, { method: 'PUT', body })
        setOriginal({ ...campos })
        setExito('Cambios guardados.')
      } else {
        const nueva = await fetchWithAuth('/prendas', { method: 'POST', body })
        navigate(`/admin/prendas/${nueva.id}`, { state: { nueva: true } })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.data?.detail)) {
        const errs = {}
        for (const item of err.data.detail) {
          const loc = item.loc?.join(' ') ?? ''
          if (loc.includes('nombre'))           errs.nombre      = item.msg
          else if (loc.includes('descripcion')) errs.descripcion = item.msg
          else if (loc.includes('precio'))      errs.precio      = item.msg
          else if (loc.includes('categoria'))   errs.categoria   = item.msg
          else                                  errs.general     = item.msg
        }
        setErrores(errs)
      } else {
        setErrorGeneral('No se pudo guardar. Inténtalo de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.btnVolver}
        onClick={() => navigate('/admin/prendas')}
      >
        ← Prendas
      </button>

      <h2 className={styles.titulo}>
        {modoEditar ? `Editar: ${original.nombre || '…'}` : 'Nueva prenda'}
      </h2>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="fp-nombre">Nombre *</label>
          <input
            id="fp-nombre"
            name="nombre"
            type="text"
            value={campos.nombre}
            onChange={handleChange}
            maxLength={200}
            className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
          />
          {errores.nombre && <span role="alert" className={styles.fieldError}>{errores.nombre}</span>}
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="fp-desc">Descripción *</label>
          <textarea
            id="fp-desc"
            name="descripcion"
            value={campos.descripcion}
            onChange={handleChange}
            maxLength={2000}
            className={`${styles.input} ${styles.textarea} ${errores.descripcion ? styles.inputError : ''}`}
          />
          {errores.descripcion && <span role="alert" className={styles.fieldError}>{errores.descripcion}</span>}
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="fp-precio">Precio (€) *</label>
          <input
            id="fp-precio"
            name="precio"
            type="number"
            step="0.01"
            min="0"
            value={campos.precio}
            onChange={handleChange}
            className={`${styles.input} ${styles.inputMono} ${errores.precio ? styles.inputError : ''}`}
          />
          {errores.precio && <span role="alert" className={styles.fieldError}>{errores.precio}</span>}
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="fp-cat">
            Categoría <span className={styles.opcional}>(opcional)</span>
          </label>
          <input
            id="fp-cat"
            name="categoria"
            type="text"
            value={campos.categoria}
            onChange={handleChange}
            maxLength={100}
            placeholder="Camisetas, Hoodies, Accesorios…"
            className={`${styles.input} ${errores.categoria ? styles.inputError : ''}`}
          />
          {errores.categoria && <span role="alert" className={styles.fieldError}>{errores.categoria}</span>}
        </div>

        {modoEditar && (
          <div className={styles.campoCheck}>
            <input
              id="fp-activo"
              name="activo"
              type="checkbox"
              checked={campos.activo}
              onChange={handleChange}
              className={styles.checkbox}
            />
            <label className={styles.checkLabel} htmlFor="fp-activo">
              Visible en el catálogo
            </label>
          </div>
        )}

        {errores.general  && <p role="alert" className={styles.errorGeneral}>{errores.general}</p>}
        {errorGeneral     && <p role="alert" className={styles.errorGeneral}>{errorGeneral}</p>}
        {exito            && <p className={styles.exitoMsg}>{exito}</p>}

        <div className={styles.botonSubmit}>
          <CtaSecondary type="submit" disabled={guardando || sinCambios}>
            {guardando ? 'Guardando…' : modoEditar ? 'Guardar cambios' : 'Crear prenda'}
          </CtaSecondary>
        </div>
      </form>

      {/* Imágenes y tallas — solo en modo editar */}
      {modoEditar && (
        <>
          <hr className={styles.divisor} />
          <SeccionImagenes
            prendaId={prendaId}
            imagenes={imagenes}
            setImagenes={setImagenes}
            fetchWithAuth={fetchWithAuth}
          />
          <hr className={styles.divisor} />
          {recienCreada && (
            <p className={styles.mensajeNueva}>Prenda creada. Añade las tallas.</p>
          )}
          <SeccionTallas
            prendaId={prendaId}
            tallas={tallas}
            setTallas={setTallas}
            fetchWithAuth={fetchWithAuth}
          />
        </>
      )}
    </div>
    </AnimatedContent>
  )
}
