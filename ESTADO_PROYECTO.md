# Estado del proyecto — πίστη (Web Barbería + Tienda de Ropa · cliente: Alex)

> Documento de continuidad. Léelo junto a `CLAUDE.md`, `BackendBarberia.md`, `METODOLOGIA.md` y `DESIGN.md` para retomar el proyecto en cualquier chat.

> **ESTADO ACTUAL: 🟢 FASE 0 · 🟢 FASE 1 · 🟢 FASE 3 CERRADAS. 🟡 FASE 4 (frontend) — TODO EL LADO CLIENTE + PANEL ADMIN DE GESTIÓN COMPLETO (tienda Y barbería).** Lado cliente completo de punta a punta. Backend con feature nueva: aperturas excepcionales. **Panel admin:** andamiaje (layout C) + **DOMINIO TIENDA COMPLETO** (Prendas con imágenes, Galería, Reservas) + **DOMINIO BARBERÍA COMPLETO** (Servicios, Horario, Excepciones cierres+aperturas, Clientes/inasistencias, **Agenda/citas con calendario reutilizado de reservar-cita**). Contacto en el nav de ambos mundos (una pantalla compartida; contenido/gestión pendiente de Alex). **Dashboard: endpoint de estadísticas en backend YA CONSTRUIDO** (`GET /admin/stats`), falta el frontend que lo pinte. **Cero decisiones abiertas.** EN CURSO: **nada activo — cierre de sesión.** SIGUIENTE: **frontend del dashboard** (pintar las métricas del endpoint ya hecho, con atajos a cada sección), luego Contacto (mini-feature gestionable por Alex, bloqueada por sus datos) y Fase 5 (despliegue). Anotada feature V1.1 post-despliegue: emails a clientes (recordatorio 24h de cita + avisos de reserva de ropa).

## Qué es

Web combinada para **Alex**, que tiene **barbería** + **marca de ropa πίστη**, en una sola app (cascarón compartido, una sola auth, una sola BD). Dos dominios:
- **Barbería**: gestión de citas, **backend idéntico a RM** (integrado, no reconstruido).
- **Tienda de ropa — "reserva sencilla"**: catálogo + el cliente reserva una **talla** + aviso por Telegram a Alex + cierre **en persona**. Sin pago online. Disponibilidad manual.

Stack: FastAPI + React (Vite, **JS**, CSS Modules) + PostgreSQL, despliegue en Render. Mobile-first, responsive. Desarrollador único (AceitunoDev).

Marca **πίστη** (griego, *fe/lealtad*): negro + blanco + **verde flúor**, lettering graffiti, símbolo **π**, lema "Loyal to the ritual". Identidad ya definida (merch + local físico).

---

## Decisiones tomadas

### Producto
- **Barbería = backend idéntico a RM**: franjas 30 min, servicios múltiplos de 30 ≤300, ventana 30 días, días cerrados, zona horaria Europe/Madrid coherente, no-solape transaccional. **Recordatorio diario incluido** (cron, Fase 5).
- **Tienda = "reserva sencilla"**: la reserva es un **lead**, NO bloquea stock; varios pueden reservar la misma talla; Alex cierra en persona.
- **Tallas + disponibilidad por talla**: el cliente elige talla y ve **disponible / no disponible**; Alex marca la disponibilidad a mano.
  - **`Prenda`**: id, nombre, descripcion, precio, categoria (opc.), imagenes (**Cloudinary — ver abajo**), activo.
  - **`TallaPrenda`**: id, prenda_id (FK), talla (S/M/L/Única…), `disponible` (bool). `UNIQUE(prenda_id, talla)`.
  - **`ReservaPrenda`**: id, cliente_id, prenda_id, talla, estado ('pendiente'|'atendida'|'cancelada'), creada_en.
  - **NO hay `stock` entero** — `disponible` es bandera manual, no stock en tiempo real.
- **Auth/usuarios compartidos**: un solo `Usuario` con rol; Alex (admin) gestiona ambos dominios; el cliente se registra una vez.
- **🆕 IMÁGENES = Cloudinary (DECISIÓN CERRADA).** Afecta a catálogo de tienda Y galería del banner. El contenido de Alex (camisetas, fotos de galería) **NO va al repo** (es dinámico): va a Cloudinary; la BD guarda **la URL + el `public_id`** (el `public_id` para poder borrar/transformar después). Campo de imágenes agnóstico al origen. **Solo los assets de marca (logo SVG, iconos) viven en el repo.**
  - **Regla de implementación (aplicada en Fase 3 y en Trozo 2a):** subida **firmada desde el backend** (el frontend pide firma a FastAPI y sube a Cloudinary con ella). **NO** unsigned upload preset abierto (cualquiera subiría a la cuenta).

### 🆕 Backend Tienda — Fase 3 (CERRADA)
Backend completo de la tienda "reserva sencilla" + galería del banner + Cloudinary. **174/174 tests en verde** (127 de Fase 1 + 47 nuevos). 5 tablas nuevas en PostgreSQL, migración Alembic encadenada desde la última.
- **Modelos:** `Prenda`, `TallaPrenda`, `ImagenPrenda` (normalizada, no JSONB — borrar/reordenar por `public_id` y `posicion`), `ReservaPrenda`, `GaleriaFoto`.
- **20 endpoints nuevos:** `POST /cloudinary/firma` (admin); CRUD `/prendas` + `/prendas/{id}/tallas` + `/prendas/{id}/imagenes`; `/reservas` (crear lead, mías, cancelar, atender, listar admin); `/galeria` (CRUD + `/galeria/orden` bulk reorder).
- **Cloudinary subida firmada:** la firma incluye `allowed_formats=jpg,png,webp` + `max_file_size=5MB` en los params **firmados side-server** (el frontend no los elige). El `api_secret` nunca sale del servidor. BD guarda solo `url` + `public_id`. Borrado en Cloudinary best-effort en BackgroundTask silenciosa.
- **Seguridad:** dos schemas separados (`ReservaReadCliente` sin teléfono / `ReservaReadAdmin` con teléfono) para que el teléfono no llegue a otros clientes; `cliente_id` siempre del token; rate limit en `POST /reservas`; `get_usuario_opcional` para que admin vea prendas inactivas y el público reciba 404. Tallas no disponibles SÍ se muestran (cliente ve "agotado", no desaparece).
- **Reserva = lead:** varios clientes pueden reservar la misma talla (sin UNIQUE de no-solape); aviso Telegram a Alex (nombre, teléfono, prenda, talla) en BackgroundTask.
- **Deuda anotada [D]:** el borrado lógico de prenda (`activo=False`) NO borra imágenes de Cloudinary (la prenda puede reactivarse). Una prenda nunca borrada físicamente acumula imágenes huérfanas → tarea futura "purga de prendas + imágenes huérfanas" (Cron Fase 5, análogo a `purga_citas.py`). `# TODO: purga_prendas` en el helper de borrado.

### Diseño (Fase 0 — ver `DESIGN.md`)
- **Dirección consolidada en el chat web** (se prescinde de Claude Design). Identidad y tokens reaprovechados.
- **Sistema de luz LED** como pieza-firma (motor único). Neón blanco = luz de marca; verde = línea-acento.
- **Dark-only**. Verde **solo acento**. Contraste AA verificado. Esquinas angulares; contención por luz.
- **Tipografía**: wordmark graffiti + script del lema como **SVG**; **Hanken Grotesk** (UI/cuerpo) + **Space Mono** (datos).
- **Arquitectura de navegación del cliente**: hub (Barbería · Tienda + banner) → cada mundo con su modelo (A vertical / B carriles) y **nav contextual**. **Sin atajo** entre mundos.
- **Nav = panel translúcido** (cristal con borde LED), inferior en móvil / lateral en desktop.
- **Banner de Alex** (hub), dos cintas opuestas: redes **estáticas en código** + galería **gestionable por Alex** (orden) → mini-feature con backend, comparte subida de imágenes con el catálogo.

### 🆕 Frontend — Fase 4 · Trozo 1 (CERRADO Y MEDIDO EN ANDROID)
Construido el cimiento visual completo, verificado en desktop (throttling 4×) y en Android de gama media real. Rendimiento **excelente** en ambos.
- **Fuentes self-hosted** (woff2 en `src/assets/fonts/`, `@font-face` en `theme.css`, `font-display:swap`). **NO Google Fonts CDN** — motivo **RGPD** (no se filtra la IP del usuario a Google). Eliminado el `<link>` a Google.
- **`theme.css` = fuente de verdad**: tokens de `DESIGN.md` §4–§6. Radios fijados: `--r` 3px, `--rlg` 8px, `--rpill` 999px.
- **Motor de luz único**: variables CSS + `@keyframes` en `theme.css`, consumidas por CSS Modules. Sombras compuestas (`--shadow-glow-green`, `--shadow-focus`), filtros SVG (`--filter-glow-white[-strong]`). Cambiar `--neon` cambia todo a la vez; sin capas de glow independientes.
- **FONDO (LedBackground) = trazos LED en Canvas 2D.** Descartadas chispas y perimetral. Trazos que nacen en punto aleatorio, blanco + verde, **flujo continuo espaciado** (varios cada 2-3 s).
  - **Dirección restringida: SOLO horizontal/vertical**, trazos **rectos o en L** (giro 90° una vez, esquina de radio muy pequeño). Fiel a las tiras del techo/zócalo del local. Técnica: `Path2D` + `setLineDash`/`lineDashOffset` para revelar la ventana iluminada; doble pasada de glow sobre el mismo path.
  - **Frenos (render continuo):** pausa por `visibilitychange` + `blur`/`focus` (verificada: CPU ~0 fuera de foco), `MAX_STROKES` cap, DPR cap 2x, `prefers-reduced-motion` → sin canvas (fondo liso). Variante `fallback-static` conmutable.
  - **Palanca de rendimiento:** `DENSITY` (bajar primero si hiciera falta). No hizo falta — rinde bien.
- **ICONOS = SVG de trazo inline** (fuera emojis). Set tipo Lucide/Feather (MIT) pegado inline, NO instalado. `stroke` en `currentColor`/`--text`. Activo = glow `--filter-glow-white`; inactivos tenues sin glow.
- **CTA con borde viajero** (conic-gradient + `@property`): SOLO CTA principal, una instancia, pausado fuera de viewport, **NUNCA en camino crítico de reserva** (§11).
- **🆕 LOGO REAL EN EL REPO.** Símbolo **π vectorizado** (SVG con paths reales, ~12 KB — confirmado vectorial, no PNG incrustado), en `frontend/src/assets/`, sustituye al placeholder; `Logo.jsx` no cambió. Glow por `filter:drop-shadow` siguiendo el trazado. El `useLedVisible` queda listo para el Metallic Paint WebGL (mejora diferida dentro de Fase 4).
  - **Pendiente menor:** confirmar/vectorizar el **wordmark graffiti completo `πίστη`** (`logoPistia.svg`) si se quiere uno distinto para el hero (π = marca compacta/header; wordmark = hero). Mismo proceso (Inkscape: trazar bitmap, **borrar el PNG de debajo**, exportar SVG optimizado; chivato de éxito = peso de pocos KB y `<path>` sin `<image>`/`base64`).
- **NAV: Plan A (cristal/blur) CONFIRMADO** — el rendimiento en Android fue excelente, sin jank de scroll, así que se mantiene el `backdrop-filter`. (El Plan B sólido queda como respaldo documentado por si en pantallas reales con scroll pesado reapareciera jank.)

### 🆕 Frontend — Fase 4 · Trozo 2 (Cascarón + navegación) CERRADO
- **React Router** instalado. `LedBackground` montado FUERA de `<Routes>` (el canvas persiste entre navegaciones, no se reinicia).
- **Hub (Nivel 0):** wordmark hero + dos puertas de mundo (Barbería · Tienda) + banner. Sin nav (es la bifurcación).
- **Dos shells (Nivel 1):** BarberiaShell (nav 3 ítems: Mis citas · Reservar · Perfil) y TiendaShell (nav 4 ítems: Catálogo · Mis reservas · Contacto · Perfil), con placeholders. **Sin atajo** entre mundos; el **logo de cada mundo es `<Link to="/">`** (salida al hub).
- **Nav contextual** reutiliza el componente del Trozo 1; indicador que viaja; `var(--nav-count)` por mundo.
- **Banner:** dos cintas marquee opuestas. Redes **estáticas en código** (`href="#"` provisional, `// TODO: URLs reales de Alex`), se detiene al tocar. Galería consume `GET /galeria` real (con **saneamiento defensivo**: `Array.isArray` + filtrar fotos sin `url`), estado vacío con π decorativos. `prefers-reduced-motion` → estáticas.
- **Bug responsive del nav vertical CORREGIDO:** el indicador LED se **mide contra la posición real** del ítem activo (no por índice fijo), robusto a ítems de distinta altura.
- **Bugs responsive del hub CORREGIDOS:** botón "Acceder" ya no desborda en móvil (header reorganizado mobile-first); banners **full-bleed** (ancho completo, fuera del contenedor con `max-width`); marquee **sin huecos** en pantallas anchas (contenido repetido hasta desbordar el viewport, desplazamiento de un bloque lógico).

### 🆕 Frontend — Fase 4 · Logo dos variantes CERRADO
- `Logo` extendido a `variant="wordmark" | "symbol"` + `size` (`sm`/`md`/`lg`). Reutiliza el glow de `theme.css` (no crea glow nuevo).
- **wordmark** = lettering πίστη completo (hero: hub y login futuro). **symbol** = π compacto (cabeceras de mundo, estático, sin shader — vive en todas las vistas).
- Assets confirmados en `src/assets/` (verificado cuál es cuál; wordmark sin fondo negro). ID del `<linearGradient>` único por instancia (evita colisión de IDs SVG).

### 🆕 Frontend — Fase 4 · AUTH CERRADA (escaparate abierto + acciones protegidas)
Modelo: **hub, catálogo y galería públicos** (sin login); **reservar, mis citas/reservas, perfil y admin exigen sesión**. Coherente con el backend (`GET /prendas` y `GET /galeria` públicos).
- **`AuthContext`:** estado `{usuario, token, cargando}`; `login()`, `register()`, `logout()`; rehidratación al arrancar (si hay token → `GET /usuarios/me`); `cargando` con lazy initializer (sin parpadeo).
- **Token en `localStorage`** (clave `pistia_token`): decisión consciente; riesgo XSS documentado y acotado (JSX escapa, sin terceros, sin `dangerouslySetInnerHTML`). Reevaluar si se añaden widgets externos.
- **`api.js`:** wrapper `apiFetch` + `ApiError` (status + `detail` de FastAPI). `fetchWithAuth` inyecta Bearer y ante 401 → `logout()` + relanza (NO navega solo, lo decide el componente).
- **`RequireAuth` / `RequireAdmin`:** esperan a `cargando`; sin sesión → `/login` guardando ruta destino; `RequireAdmin` andamiado (rol admin) para cuando exista el panel.
- **Login** (pantalla escaparate: wordmark + Blur Text), **Registro** (stepper 2 pasos, validación espejo del backend, mapeo 409/422 a errores inline con salto al paso). **Auto-login tras registro**. **Loop de redirección saneado** (from = ruta de auth → `/`). **Logout funcional** en el chip del nombre del hub (no temporal).
- **Alex accede por el MISMO login**; su `rol=admin` en el JWT es lo que le abrirá el panel. Frontend esconde por rol; backend protege con `solo_admin`.

### 🆕 Frontend — Fase 4 · Metallic Paint WebGL CERRADO (MEDIDO, se queda)
- Efecto metálico **WebGL puro (cero dependencias nuevas)** SOLO en `variant="wordmark"` (hero). El símbolo π **nunca** lo lleva.
- Máscara alpha del SVG por `discard` → el metálico sigue la silueta del lettering. Glow blanco del CSS por encima (relleno metálico + halo blanco, sin verde en el shader).
- **Frenos:** pausa fuera de viewport (`useLedVisible`) **+ `visibilitychange`/`blur`/`focus`** (pestaña oculta/sin foco → rAF parado). `prefers-reduced-motion` reacciona **en caliente** (apaga el shader sin recargar). `onFallback` en TODA la cadena (contexto WebGL, compilación, carga de textura) → SVG estático. `staticMode` conmutable.
- **Medido en Android real: rinde y no calienta → se queda** (`staticMode` default false).

### 🆕 Frontend — Fase 4 · Interactividad móvil CERRADA
Alex usa móvil → los `:hover` no se aprecian. Solución con dos tratamientos distintos:
- **Hover decorativo → pulso "respiración"**: latido tenue del borde/línea de luz (~3-4s, `box-shadow`/`opacity`, GPU-friendly), reutilizando el motor de `theme.css`. Solo en **escaparate** (tarjetas del hub y de otras pantallas de escaparate, **sin abusar**); NUNCA en el camino de reserva (§11). Verde solo acento (borde que late, no relleno).
- **Hover de feedback → `:active` táctil** (confirma la pulsación al tocar). `:hover` se conserva para desktop con `@media (hover:hover)`.
- `prefers-reduced-motion` → sin latido (borde encendido fijo).

### 🆕 Frontend — Fase 4 · PANTALLAS REALES DE TIENDA (cliente) CERRADAS
Toda la tienda del lado cliente, de punta a punta: catálogo → detalle → reserva → mis reservas.
- **Patrón de estados REUTILIZABLE** (`src/components/ui/`): `EstadoCargando` (barra LED que escanea, no spinner genérico), `EstadoError` (mensaje parametrizado + reintentar), `EstadoVacio` (π decorativos). Base para todas las pantallas siguientes.
- **Catálogo** (`/tienda`, público, `GET /prendas`): modelo B (carriles horizontales por categoría → grid en desktop). Tarjeta con primera imagen Cloudinary (fallback π si null), nombre, precio (Space Mono, `Number()` antes de formatear), tallas con disponible/AGOTADO (tachada, no oculta). Pulso respiración con stagger. Categorías **string libre con normalización defensiva** (trim+minúsculas para agrupar; `// TODO` categorías controladas pendiente de Alex).
- **`utils/cloudinary.js` PROVISIONAL:** parte la URL por `/upload/` (no `replace` ingenuo — una URL real ya traía `f_auto,q_auto`, que se duplicaría). Inserta el width. `onError` → URL original (nunca imagen rota). **`// TODO`: afinar contra URL real del backend (flujo firmado) cuando exista el admin.** → **AFINADO en Trozo 2a** (ver abajo).
- **Detalle + reserva** (`/tienda/prenda/:id`, público con acción protegida): carousel de fotos de UNA prenda (transform, dots móvil/arrows desktop, fallback π), selector de talla (agotadas no seleccionables). Reservar: sin sesión → `/login` → vuelve al detalle (re-fetch fresco) → pulsa de nuevo; con sesión → `POST /reservas`. Maneja 403/422/429. Confirmación inline LED honesta ("Reserva registrada. **Te contactaremos** para cerrar la reserva" — nunca "Alex", el cliente no le conoce). Seleccionar otra talla resetea la confirmación (permite reservar varias).
- **Mis reservas** (`/tienda/reservas`, **protegida entera** con `RequireAuth`): `GET /reservas/mias`, orden recientes primero. Estado traducido con puntos de color **semánticos §4** (pendiente=aviso, atendida=éxito, cancelada=faint) — NUNCA el verde de marca. Cancelar solo pendientes, con **confirmación de dos pasos** (no destructivo al primer toque), actualización optimista + re-fetch silencioso en 422. Estado vacío con enlace al catálogo.
- **`CtaSecondary` nuevo** (borde estático, `danger`, `size`) — botón secundario que faltaba, reutilizable.
- **`fetchWithAuth` confirmado estable** (`useCallback` en AuthContext) — cimiento sólido para todas las pantallas protegidas que vienen.

### 🆕 Frontend — Fase 4 · PERFIL a ruta única + CHIP DE SESIÓN CERRADO
- **Perfil movido a `/perfil` raíz** (con `RequireAuth`), FUERA de los shells. Eliminadas las rutas duplicadas `/barberia/perfil` y `/tienda/perfil` (catch-all interno redirige URLs huérfanas al shell raíz). Perfil sigue siendo **placeholder** (contenido real —datos, cambio de contraseña— es trozo posterior). Salir del perfil / logout → vuelve al hub.
- **Nav contextual actualizado:** Barbería 2 ítems (Mis citas · Reservar), Tienda 3 ítems (Catálogo · Mis reservas · Contacto). Perfil sale del nav → pasa al chip. `--nav-count` derivado de `items.length` (se ajusta solo).
- **`SesionChip` reutilizable** (hub + cabecera de los dos mundos, misma fuente de verdad): con sesión → nombre + mini-menú (Mi perfil · Cerrar sesión), cierre por clic-fuera/Esc, `role=menu`. Sin sesión → "Acceder" (también en los mundos, coherente con el hub; las rutas públicas lo muestran, las protegidas ya redirigen). `cargando` → null (sin parpadeo). Logout accesible desde cualquier pantalla (no espera al perfil real).

### 🆕 Backend — APERTURAS EXCEPCIONALES (feature NUEVA, no estaba en RM) CERRADA
Alex puede ABRIR un día normalmente cerrado (p. ej. un sábado con evento) con tramos horarios propios. El contrato (§3) ya lo preveía como extensión de `ExcepcionFecha`. **192 tests en verde** (174 + 18 nuevos).
- **`ExcepcionFecha.tipo`** extendido de `{'cerrado'}` a `{'cerrado','abierto'}`. Como usa `native_enum=False` (VARCHAR en Postgres), **NO hay `ALTER TYPE`** — la migración solo crea la tabla nueva `tramos_apertura` (bajo riesgo, segura con datos existentes).
- **`TramoApertura`** (tabla nueva, FK a `ExcepcionFecha`, CASCADE): una apertura lleva 1+ tramos horarios propios; un cierre lleva 0. Mismos atributos que `HorarioPeluquero` (`hora_apertura`/`hora_cierre`) → **duck typing**: `_calcular_disponibles` los consume sin cambios.
- **Reglas:** apertura sin tramos → 422; cierre con tramos → 422; tramos solapados → 422; horas múltiplos de 30. **Precedencia:** si una fecha tiene apertura, sus tramos SUSTITUYEN al horario semanal ese día (solo esa fecha). `UNIQUE(fecha)` → una fecha es O abierta O cerrada, nunca ambas.
- **Disponibilidad y `POST /citas`:** intercalado el check `'abierto'` tras el de cierre — usa los tramos de la apertura aunque no haya horario semanal ese día. Resto del cálculo idéntico. **Zona horaria Europe/Madrid** reutilizando `now_madrid` (test "para HOY" obligatorio incluido).
- **Endpoints:** `POST /excepciones` acepta `'cerrado'` o `'abierto'`+tramos; `GET /excepciones` y `/excepciones/proximas` devuelven tipo y tramos (el calendario del cliente y el admin los necesitan); `DELETE` de apertura con citas activas ese día → 409 (no dejar citas huérfanas). Compatibilidad backward: `POST {fecha}` sin tipo → cierre, como antes.

### 🆕 Frontend — Fase 4 · RESERVAR CITA (barbería, cliente) CERRADA
Pantalla más compleja del frontend. Mismo FLUJO que RM (backend idéntico), piel de πίστη. Protegida (`RequireAuth`).
- **Embudo en UNA sola pantalla** (stepper que revela pasos, no pantallas separadas): servicio → fecha → hora → confirmar.
- **Calendario a medida** (sin librería, regla del stack): ventana `[hoy, hoy+30]` Europe/Madrid; días fuera → deshabilitados; días sin horario semanal Y sin apertura → deshabilitados; días cerrados → deshabilitados; **días con apertura excepcional → seleccionables** aunque su día de semana no abra normalmente (enganche con la feature de backend). Deshabilitado accesible (`aria-disabled`).
- **El frontend NO recalcula disponibilidad:** `GET /disponibilidad` devuelve solo las horas válidas (backend ya calculó todo); el frontend las pinta como chips. Vacío → "No hay huecos" (no error).
- **`POST /citas`** con manejo completo: **409** (hueco ocupado — CASO ESTRELLA: recarga disponibilidad automáticamente y deja reelegir hora, no error muerto), **422** (recarga), **403** (bloqueado, "contacta con la barbería", no "Alex").
- **Camino crítico (§11):** SIN render continuo pesado — sin Metallic Paint, sin borde viajero, sin pulso respiración en este flujo. Stepper y chips estáticos.

### 🆕 Frontend — Fase 4 · MIS CITAS (barbería, cliente) CERRADA
Cierra TODO el dominio de cliente. Protegida (`RequireAuth`). Reutiliza el patrón de "mis reservas".
- **`estadoCita.js`** = helper PURO testeable (`estadoDerivado`, `esCancelable`, con `ahoraISO` inyectable). **Estados derivados §4.7 EXACTOS:** activa+futura=Reservada, activa+pasada=Realizada, no_asistida=No asistió, cancelada=Cancelada. **Nunca "Confirmada".** Usa `hora_inicio` (no `hora_fin`) para futura/pasada, alineado con el check del backend (evita la ventana falsa botón-aparece-pero-422). Comparación en Europe/Madrid vía `Intl` (sin aritmética de offset).
- **Dos grupos con jerarquía visual:** "Próximas" (solo Reservada) a opacidad plena + borde sutil + botón cancelar; "Anteriores" (todo lo demás) atenuadas (opacity 0.55), sin acciones. Encabezados Space Mono condicionales. **Cancelada-futura → Anteriores** (Próximas = solo lo que va a ocurrir de verdad).
- **Colores de estado semánticos §4** (verde de marca NUNCA): Reservada=info (azul), Realizada=éxito (verde semántico), No asistió=error, Cancelada=faint.
- **Cruce defensivo `servicio_id`→nombre** (el endpoint de citas da el id): `GET /servicios` + map; si el servicio fue desactivado tras la cita → "Servicio no disponible" (no "undefined").
- **Cancelar** solo las Reservada, confirmación de dos pasos, `PATCH /citas/{id}/cancelar`, optimista + `recargarSilencioso` en 422. Inasistencias NO aquí (las marca Alex en el admin).
- `formatFechaCita` con constructor de fecha local (evita bug UTC día-anterior).

### 🆕 Frontend — Fase 4 · PERFIL REAL CERRADO
Rellena el `/perfil` (antes placeholder). Protegido (`RequireAuth`). Dos secciones, dos forms independientes.
- **Mis datos:** `GET /usuarios/me` (ya lo trae el AuthContext, sin fetch extra) + `PATCH /usuarios/me` (whitelist nombre_completo + telefono). Email **solo lectura** (identificador de login, no se cambia). Validación espejo del registro (nombre dos palabras, teléfono España). `setUsuario` expuesto en AuthContext para refrescar el nombre en el `SesionChip` tras editar.
- **Contraseña:** `PATCH /usuarios/me/password` con `password_actual` + `password_nueva` + **repetir** (validación cliente: coinciden, ≥8). Toggle mostrar/ocultar en los tres campos. **Verificado en backend:** contraseña actual incorrecta = **400** (no 401/422); el **token SOBREVIVE** al cambio (JWT sin blacklist, la sesión sigue, no hay re-login). Manejo 400/429/422.
- Sin logout propio (ya en el chip). CtaSecondary en ambos botones (evita dos bordes viajeros simultáneos). **Cierra la Fase 4 del lado cliente por completo.**

### 🆕 Frontend — Fase 4 · PANEL ADMIN · ANDAMIAJE CERRADO
Estructura del admin (sin gestión real todavía — cada sección placeholder). Layout C, mobile-first (Alex usa móvil).
- **Ruta `/admin/*`** bajo `RequireAdmin` (ya existía como named export; comprueba `rol !== 'admin'` → redirect a `/`). Entrada por defecto `/admin` → `/admin/resumen`.
- **Layout C (foco + cajón):** drawer lateral plegable (transform, overlay **solo móvil + abierto**, fijo en desktop ≥768px con `margin-left: 280px`) + área de trabajo. Cierre por overlay/Escape/selección. Accesibilidad: `aria-expanded`/`aria-controls`/`aria-label` en el botón menú, manejo de foco al abrir/cerrar. `100dvh` verificado en Android. Icono de menú del set SVG (no carácter ☰).
- **Navegación agrupada** en el cajón (placeholders): **Inicio** (Resumen/dashboard — entrada por defecto), **Barbería** (Agenda/citas, Servicios, Horario, Días cerrados y apert., Clientes), **Tienda** (Prendas, Reservas), **Sitio** (Galería, Contacto). Indicador activo por `border-left` LED + background tenue (no el span animado del cliente — más robusto con alturas heterogéneas). Reutiliza el motor de luz, no crea sistema nuevo.
- **Acceso desde `SesionChip`:** entrada "Panel de administración" visible SOLO si `rol === 'admin'`; lleva a `/admin`. Los clientes no la ven.
- **Dashboard/Resumen = placeholder.** Las métricas reales necesitan un **endpoint de estadísticas en el backend** (trozo futuro). Métricas previstas (accionables primero): barbería = citas de esta semana/hoy, inasistencias/bloqueados; tienda = reservas pendientes, de la semana, totales; transversal = "pendientes de atención". NO contar en el frontend trayendo todo (no escala) → hacerlo en backend.

### 🆕 Frontend/Backend — Fase 4 · PRENDAS Trozo 1 (CRUD + tallas + borrado) CERRADO
Primera sección de gestión real del admin (`/admin/prendas`), layout C móvil. Rellena el placeholder de "Prendas".
- **Backend — dos gaps auditados y resueltos:**
  - **GAP-1 · listar inactivas:** `GET /prendas` gana el query param `incluir_inactivas: bool = false` (nombre coherente con `?incluir_inactivos` de servicios en RM, sin doble negación). Solo un admin (vía `get_usuario_opcional` + check de rol) puede pasarlo a `true`; **cliente y anónimo siempre ven solo activas** aunque lo pasen. Sin esto, la lista del admin no podría mostrar ocultas ni recuperar una desactivada.
  - **GAP-2 · borrado físico:** el `DELETE /prendas/{id}` existente era soft-delete (`activo=False`), idéntico a `PUT {activo:false}`. Nuevo endpoint **`DELETE /prendas/{id}/permanente`** (gateado `solo_admin`, ruta ANTES de la genérica) para el borrado real. Bloquea con **409** si hay reservas **PENDIENTES** (mensaje con el conteo); las reservas **históricas** (atendidas/canceladas) se borran **en cascada a propósito** (historial se pierde, aceptado — para conservar historial ya está desactivar). **Cascade del modelo verificado en código real** antes de implementar (no de memoria): tallas, imágenes y reservas arrastradas por el borrado.
- **Tests backend:** 204 (sin reservas), 404 (no existe), 409 (reservas pendientes), **403 (no-admin)**, y **borrado con reservas históricas no-pendientes → 204** (el test que ejercita la FK de `ReservaPrenda` y confirma que el cascade no revienta).
- **Frontend — lista (`AdminPrendas`):** filtro Todas / Visibles / Ocultas (estado local, filtrado **cliente-side** sobre datos ya cargados — volumen pequeño de catálogo admin, aceptable, NO es el caso de stats que se rechazó). Hook `useAdminPrendas` (patrón de `useCitas`, llama `GET /prendas?incluir_inactivas=true` con token admin). Tarjeta: placeholder de imagen 48×48, nombre, precio (Space Mono), categoría (`--faint`), badge **VISIBLE/OCULTA**, inactivas atenuadas (opacity 0.55). Acciones: **Editar** / **Activar-Desactivar** (`PUT`, optimista con reversión) / **Borrar permanente** (`CtaSecondary danger`, separado visualmente, **confirmación reforzada inline** —panel en la propia tarjeta, no modal flotante, más mobile-friendly— con texto de irreversibilidad; 409 → mensaje de reservas pendientes en la tarjeta).
- **Frontend — formulario (`FormPrenda`):** compartido crear/editar por `useParams` (`modoEditar = !!prendaId`). Datos básicos: nombre, descripción (`<textarea>`), precio (`step=0.01 min=0`), categoría (**string libre** — deuda: `<select>` si Alex confirma categorías). Checkbox **Visible solo en modo editar** (al crear nace `activo=true` por defecto del backend, coherente con `PrendaCreate` sin campo activo). Crear → `POST /prendas` → redirige a editar con mensaje "Prenda creada". Editar → `PUT` con cambios (botón deshabilitado si no hay cambios, patrón `datosIguales` de Perfil). Verificado que `PrendaUpdate` acepta body parcial (todos los campos opcionales) — de ahí que el toggle activo/inactivo desde la lista pueda mandar solo `{activo}`.
- **Tallas dentro de la edición:** cargadas de `PrendaDetalleRead.tallas`. Añadir (`POST /prendas/{id}/tallas`, 422 UNIQUE → "ya existe"), toggle disponible (`PATCH`, optimista), quitar (`DELETE`; 409 si tuviera reservas pendientes — manejado defensivo aunque `ReservaPrenda.talla` es string, no FK). SIN imágenes (eso es Trozo 2a/2b).

### 🆕 Frontend/Backend — Fase 4 · PRENDAS Trozo 2a (imágenes: subir + mostrar) CERRADO
Gestión de imágenes desde el admin mediante **subida firmada a Cloudinary**. Solo subir y mostrar (reordenar/borrar = Trozo 2b).
- **Cloudinary configurado y operativo:** cuenta real, cloud name `qlvzyf5f`. **Credenciales ROTADAS** (el secreto inicial se expuso en un pantallazo → generada API key nueva, revocada la vieja "Root"). Secreto **solo en `.env` local** (NO en repo; irá como env var `sync:false` en Render, Fase 5). `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`.
- **Flujo firmado verificado de punta a punta (prueba real 200 ANTES de montar el frontend):**
  - `POST /cloudinary/firma` (solo_admin): body `{folder}`; firma **exactamente** `timestamp + folder + allowed_formats + max_file_size`; devuelve `{signature, timestamp, api_key, cloud_name, folder, allowed_formats, max_file_size}`. El `cloud_name` viene en la respuesta (el frontend NO lo hardcodea).
  - Frontend sube **directo** a `https://api.cloudinary.com/v1_1/{cloud_name}/image/upload` con `FormData` de **exactamente** los params firmados (7 campos: `file` + `api_key` + `signature` + `timestamp` + `folder` + `allowed_formats` + `max_file_size`). **Ni uno más** (nada de `upload_preset`/`resource_type`) → evita "Invalid Signature". Sin `Content-Type` manual (el navegador pone el boundary). **La prueba real confirmó que `allowed_formats`/`max_file_size` como params firmados directos SON aceptados por esta cuenta** (era el riesgo C1: en algunas cuentas solo funcionan dentro de un preset).
  - Cloudinary responde `secure_url` + `public_id` → `POST /prendas/{id}/imagenes` con `{url, public_id}`; el backend asigna **`posicion = count*10`** (el frontend NO envía posición). Respuesta `ImagenRead {id, url, posicion}` (el `public_id` NO se expone en la lectura).
- **Límite de 8 imágenes/prenda:** NO existía en backend → añadido `MAX_IMAGENES_PRENDA = 8` con check en `añadir_imagen` (**409** al registrar la 9ª). Frontend además deshabilita el input al llegar a 8. Tests: **8ª entra (200)** + **9ª rechazada (409)**.
- **Sección IMÁGENES** en `FormPrenda` (solo modo editar, como las tallas): grid ordenado por `posicion` (el ORM ya ordena, no se ordena en cliente). Input `type=file accept=image/jpeg,png,webp`. Validación cliente de **tipo y tamaño (≤5MB) ANTES** de pedir firma (no gastar llamadas). Estados subiendo (indicador LED, input deshabilitado) / error por fichero (inline) / tope (aviso + input off). Toque ≥44px.
- **`utils/cloudinary.js` AFINADO** (cerrada la deuda del `// TODO` provisional): parte por `/upload/` (respeta transformaciones previas como `f_auto,q_auto`, no las duplica), inserta el width, `onError` con **guarda anti-bucle** (`dataset.fallback`) → nunca imagen rota ni bucle de error. Folder de subida: `pistia/prendas`.
- **Carousel del cliente (detalle de prenda) — DOS fixes:**
  - **Slides descuadrados (desfase acumulativo):** causa raíz = `flex-basis: auto` dejaba que flexbox tomara el `max-content` de la imagen (~800px de Cloudinary) como base, no el ancho del track → `translateX(-N*100%)` se quedaba corto y el desfase crecía con cada slide. Fix: **`.slide { flex: 0 0 100% }`** (una línea de CSS, JS ya era correcto).
  - **Swipe táctil añadido (móvil):** gesto **seco con umbral** (cambia al soltar si supera ~50px/15-20% del ancho), **reutiliza los setters de índice** de arrows/dots (sin duplicar navegación), **distingue swipe horizontal de scroll vertical** (deltaX vs deltaY → no secuestra el scroll de página), `touch-action: pan-y`. Respeta `prefers-reduced-motion`. Verificado en Android real.

### 🆕 Frontend/Backend — Fase 4 · PRENDAS Trozo 2b (reordenar + borrar imágenes + purga) CERRADO
Completa la gestión de imágenes de prenda: cada miniatura del grid admin gana controles reordenar/principal/borrar. Resuelve además la deuda de purga de Cloudinary al borrar prenda entera.
- **Auditoría backend:** el `DELETE /prendas/{id}/imagenes/{imagen_id}` **ya purgaba Cloudinary** desde Fase 3 (captura `public_id` antes del delete, BackgroundTask) — sin deuda ahí. `posicion` **NO tiene UNIQUE** (verificado en modelo) → bulk reorder directo `idx*10` seguro. NO había bulk reorder para prendas → **añadido `PUT /prendas/{id}/imagenes/orden`** (patrón de `/galeria/orden`, `list[{id, posicion}]`, filtrado por `prenda_id` como seguridad anti-cross-prenda, 404 si la imagen no es de esa prenda).
- **Purga al borrar prenda entera:** resueltos los 2 `# TODO` en `borrar_prenda_permanente` — captura `public_id`s **antes** del `db.delete(p)`, borra reservas explícitamente, y encola `borrar_imagen` en BackgroundTask por cada imagen. Test de que se invoca la purga por cada imagen.
- **Frontend (sección IMÁGENES de FormPrenda):** cada miniatura con controles ↑ subir / ↓ bajar / ★ hacer principal / ✕ borrar (≥44px, grid a 2 columnas). Reordenar optimista con posiciones limpias `idx*10` (recompacta gaps de borrados) + revert en error. "Hacer principal" = a posición más baja (portada). Borrar con confirmación ligera de dos pasos (no la reforzada del borrado de prenda). Race guard `ocupado` entre operaciones. Cancelar borrado limpia el error huérfano.
- **Tests backend:** reordenar → 200 `{updated:N}` + posiciones persistidas; imagen de otra prenda → 404; borrado permanente purga Cloudinary (destroy mockeado por imagen).

### 🆕 Frontend — Fase 4 · FIX lista admin: miniatura de portada CERRADO
La tarjeta de `/admin/prendas` mostraba un placeholder gris 48×48 (puesto en Trozo 1 cuando no había imágenes). Ahora muestra la **imagen principal** (posición más baja) de cada prenda, vía `utils/cloudinary.js` (width pequeño para nitidez 2x), `object-fit:cover`, `onError` con guarda anti-bucle. Prenda sin imágenes → placeholder. Coherente con el "hacer principal": cambiar la portada se refleja en la lista.

### 🆕 Frontend — Fase 4 · GALERÍA DEL BANNER (admin) CERRADA
Sección `/admin/galeria` (grupo "Sitio" del cajón). Gestión de las fotos de la cinta marquee del hub que Alex administra. **Backend íntegro desde Fase 3 → 0 cambios de backend.**
- **Auditoría (todo verificado con línea):** modelo `GaleriaFoto` (id, url, public_id, posicion sin UNIQUE, titulo opcional); `DELETE /galeria/{id}` **ya purga Cloudinary** (BackgroundTask); `PUT /galeria/orden` = `GaleriaOrdenItem {id, posicion}` (mismo formato que prendas); `POST /cloudinary/firma` acepta cualquier folder → `pistia/galeria`. Colección plana (no cuelga de ninguna entidad).
- **Frontend (reutiliza el patrón de imágenes de Prendas):** pantalla propia con grid, subida firmada (folder `pistia/galeria`), reordenar con flechas ↑↓ (sin "hacer principal" — la galería no tiene portada, es una cinta), borrar con confirmación de dos pasos, race guard, `onError` anti-bucle. **Estado vacío orientado a acción** (invita a subir la primera, no π mudos). Cambios se reflejan en el banner del hub (`GET /galeria`).
- **Decisiones:** **tope 12 fotos SOLO frontend** (decisión consciente: a diferencia de las 8 de Prendas que van también en backend, aquí la galería la gestiona solo el admin, sin concurrencia ni consumo por terceros → guard solo-cliente es suficiente). **`titulo` sin UI** (`alt=""` decorativo, WCAG-correcto para imágenes decorativas). Alineada la limpieza de error al cancelar borrado entre esta pantalla y la de imágenes de prenda (mismo comportamiento).

### 🆕 Frontend/Backend — Fase 4 · RESERVAS DE TIENDA (admin) CERRADA — CIERRA EL DOMINIO TIENDA
Sección `/admin/reservas` (grupo "Tienda"). Alex gestiona desde el panel las reservas (leads) que hoy solo recibía por Telegram. Con esto el dominio tienda del admin queda completo de punta a punta.
- **Auditoría backend:** listado admin usa `ReservaReadAdmin` **CON teléfono** gateado `solo_admin` (el teléfono NUNCA llega a endpoints de cliente — `ReservaReadCliente` no lo lleva). Endpoints de atender/cancelar de Fase 3 confirmados.
- **DESATENDER (NUEVO):** el backend de Fase 3 no permitía revertir `atendida → pendiente`. **Añadida la transición** (endpoint/estado gateado `solo_admin`) para que Alex pueda deshacer un "atender" erróneo. Test de la transición + gating.
- **Diseño — escala de 3 niveles de protagonismo** (vuelta de tuerca sobre el Próximas/Anteriores de Mis Citas):
  - **Nivel 1 · Pendientes** — máximo protagonismo, arriba, opacidad plena, con acciones y `tel:`. Requieren acción (llamar y cerrar).
  - **Nivel 2 · Atendidas** — protagonismo MEDIO, **siguen visibles y con peso** (NO atenuadas como pasado muerto): Alex atiende varias al día y necesita no olvidar rematar alguna. Llevan "desatender".
  - **Nivel 3 · Canceladas** — mínimo protagonismo, atenuadas, al fondo, sin acciones.
- **Cada reserva:** nombre del cliente, **teléfono como enlace `tel:`** (un toque llama — Alex móvil), prenda (nombre, cruzado con catálogo si el endpoint da solo `prenda_id`), talla, estado con punto de color semántico §4 (pendiente=aviso, atendida=éxito, cancelada=faint; NUNCA verde de marca), fecha (Space Mono).
- **Acciones:** pendiente → Atender / Cancelar (ambas con confirmación de dos pasos); atendida → Desatender (dos pasos); cancelada → sin acciones. Optimista + revert + error inline por reserva. Race guard. Estado vacío. **Lista global** (filtro por prenda = mejora futura anotada).

### 🆕 Frontend — Fase 4 · SERVICIOS (barbería admin) CERRADO
Primera sección del dominio barbería del admin (`/admin/servicios`). CRUD de servicios reutilizando el patrón de AdminPrendas, más simple (sin imágenes, sin tallas).
- **Backend:** 0 cambios (CRUD de servicios existe de RM). `GET /servicios?incluir_inactivos=true` (con 'o', nombre RM) para que el admin vea inactivos; `PUT` parcial para el toggle; `DELETE` = borrado LÓGICO. **NO hay borrado físico** de servicios (rompería las citas históricas que los referencian por FK `servicio_id`) — solo desactivar/reactivar.
- **Frontend:** lista con filtro Todos/Activos/Inactivos (cliente-side), tarjeta con nombre, duración formateada legible ("1 h 30 min"), precio Space Mono, badge ACTIVO/INACTIVO. Form crear/editar compartido por `useParams`. **Duración = `<select>` en pasos de 30 (30..300)**, etiquetas legibles, derivado de FRANJA_MINUTOS/DURACION_MAX_MINUTOS (no lista hardcodeada) → Alex no puede meter un 45 o un 350. Checkbox Visible solo en editar.
- **FIX 422 en crear:** el POST daba 422 "Input should be a valid dictionary" — el body no llegaba como JSON al backend (desalineado con el patrón de FormPrenda). Corregido alineando el envío con FormPrenda. De paso verificado: `duracion_minutos` se envía como entero (no la etiqueta del select) y `precio` con punto decimal (no coma).

### 🆕 Frontend — Fase 4 · HORARIO (barbería admin) CERRADO
Sección `/admin/horario`: los tramos de apertura semanales (jornada partida). Backend de RM, 0 cambios.
- **Modelo mental "por día de la semana"** aunque el backend guarde tramos sueltos (`HorarioPeluquero`, sin unique en `dia_semana`). La pantalla agrupa VISUALMENTE por día: los 7 días (0=lunes..6=domingo, respetado) siempre visibles; bajo cada uno sus tramos ordenados, o "Cerrado" si no tiene.
- **SOLO añadir/quitar tramos** (NO editar in situ): para cambiar un tramo, Alex lo borra y crea otro. `POST /horario` (un tramo) + `DELETE /horario/{id}`. El horario se configura una vez y se toca poco.
- **Horas en pasos de 30** (:00/:30) vía selects, coherente con las franjas. Añadir tramo: mini-form inline con inicio<fin validado en cliente; el **solape lo valida el BACKEND → 409**, el frontend solo muestra el mensaje (NO replica la lógica de solape). Quitar tramo con confirmación de dos pasos. Optimista + revert. Race guard.

### 🆕 Frontend — Fase 4 · EXCEPCIONES (barbería admin) CERRADA
Sección `/admin/excepciones`: fechas que se salen del horario semanal. UNA pantalla con dos sabores: CERRAR un día y ABRIR excepcionalmente (aperturas = feature de Fase 4, no en BackendBarberia.md → verificado contra código real). Backend completo (33 tests), 0 cambios.
- **Auditoría verificada línea a línea:** `ExcepcionFecha` (fecha UNIQUE, tipo 'cerrado'/'abierto') + `TramoApertura` (FK CASCADE). `GET /excepciones` (admin, todas). `POST /excepciones` shape: cierre `{fecha, tipo:'cerrado'}`, apertura `{fecha, tipo:'abierto', tramos:[{hora_apertura, hora_cierre}]}`. `DELETE` devuelve 200 con el objeto (no 204). **Sin límite de fecha en backend** → el frontend ofrece hasta ~5 meses. Serialización time "HH:MM:SS" → `.slice(0,5)`.
- **Errores manejados con su mensaje real:** cerrar día con citas activas → **409 con el conteo** en el string (mostrado directo: "hay N cita(s) activa(s)"); fecha ya existe → 409; borrar apertura con citas activas → 409. Validaciones de tramos (solape, múltiplos de 30, sin tramos) → 422, cubiertas por los selects pero manejadas.
- **DECISIÓN cerrar/abrir también HOY** (no solo desde mañana): caso real (imprevisto de última hora, Alex enfermo por la mañana). `min` del date-picker = HOY, coherente con la lista que muestra desde HOY.
- **Bug UTC día-anterior atajado** con `parseFechaISO`/`isoLocal` en constructor local (mismo patrón que Mis Citas). `TRAMO_DEFECTO` clonado al usarse (no compartido por referencia). Confirmación de dos pasos en borrar. Race guard.
- **⚠️ BUG DE MIGRACIÓN RESUELTO (no era de este trozo):** al probar, 500 en `GET /excepciones` → `relation "tramos_apertura" does not exist`. La migración de aperturas (Fase 4) **nunca se había aplicado sobre el Postgres local de Docker** (los tests corren en SQLite recreando el esquema, no ejercitan migraciones — tarea suelta anotada en el handoff). Resuelto con `alembic upgrade head` sobre el Postgres de Docker (con el `postgresql-x64-18` de Windows parado por el puerto 5432). **Lección reforzada: correr `alembic upgrade head` en local tras integrar una feature con migración, no fiarse solo del verde de pytest.** En Fase 5 el `upgrade head` va en el pre-deploy, así que no morderá en producción.

### 🆕 Frontend — Fase 4 · CLIENTES / INASISTENCIAS (barbería admin) CERRADO
Sección `/admin/clientes`: Alex ve los clientes registrados, su contador de inasistencias, y bloquea/desbloquea (veto de reserva → `POST /citas` 403 si `bloqueado`). Backend de RM.
- **Auditoría + privacidad:** `GET /usuarios` gateado `solo_admin`, expone datos personales (email, teléfono, nombre) — confirmado que ningún endpoint de cliente los filtra y que no se expone `password_hash`. Lista filtrada a **rol='cliente'** (los admins no aparecen). Rutas de bloquear/desbloquear verificadas contra el código real (BackendBarberia.md era vago aquí).
- **Contador de inasistencias = SOLO LECTURA** (el backend lo incrementa solo al marcar no-asistida; no se resetea aquí). Se destaca visualmente si es alto (≥3) con color de aviso semántico §4 (nunca verde de marca).
- **Frontend:** cada cliente con nombre, email, teléfono como `tel:`, contador (Space Mono), badge activo/bloqueado. Bloquear/desbloquear **con confirmación de dos pasos** (impide reservar a una persona real). Optimista + revert, error inline por cliente. Race guard. Estado vacío.

### 🆕 Frontend — Fase 4 · CONTACTO en ambos mundos CERRADO
La entrada "Contacto" ahora aparece en el nav de BARBERÍA además del de TIENDA, apuntando a **una sola pantalla de Contacto compartida** (NO duplicada — mismo criterio que `/perfil`, ruta única reutilizada, para que el contenido real se rellene una sola vez). Pública (sin login). Nav de barbería pasa a 3 ítems (Mis citas · Reservar · Contacto), `--nav-count` ajustado, indicador LED medido contra posición real (sin el bug de índice fijo). **El CONTENIDO real de Contacto sigue pendiente de Alex** — ver "Contacto" en decisiones/pendientes abajo (es una MINI-FEATURE gestionable, no una pantalla estática).

### 🆕 Frontend — Fase 4 · AGENDA / CITAS (barbería admin) CERRADA — PANEL DE GESTIÓN COMPLETO
Última sección de barbería (`/admin/citas`). Alex ve las citas de un día, navega entre días, marca no-asistida y puede cancelar. Con ella el panel de gestión queda COMPLETO (tienda + barbería). Backend de RM, 0 cambios.
- **Auditoría:** `CitaRead` devuelve **solo IDs** (cliente_id, servicio_id), sin datos anidados → doble cruce en frontend: `servicioMap` (`GET /servicios?incluir_inactivos=true`, patrón de Mis Citas) + `clienteMap` (`GET /usuarios` filtrado a rol='cliente', misma fuente que Clientes). `GET /citas?fecha=` filtra por día, ORDER BY hora_inicio. `PATCH /citas/{id}/no-asistida`: solo cita PASADA y ACTIVA (409 si ya no_asistida/cancelada, 422 si futura), incrementa `Usuario.inasistencias`. `PATCH /citas/{id}/cancelar` acepta admin (libera franjas).
- **Reutiliza `estadoCita.js`** (helper puro de Mis Citas, §4.7) sin reescribir. Estados derivados con color semántico §4.
- **Cruce defensivo (C1):** si un `cliente_id`/`servicio_id` no está en su map (cliente dado de baja, servicio borrado) → "Cliente/Servicio no disponible" y omitir el `tel:`, sin crashear (mismo criterio que Mis Citas).
- **Acciones:** "No asistió" SOLO en citas Realizada (pasada+activa); "Cancelar" SOLO en Reservada (futura+activa). Ambas con confirmación de dos pasos, optimista + revert. Race guard global (`procesandoId`). Teléfono del cliente como `tel:`.
- **Navegación por día:** flechas ‹ › + calendario + atajo "Hoy". Bug UTC atajado con `isoLocal`.

### 🆕 Frontend — Fase 4 · FIX Agenda: calendario reutilizado de reservar-cita CERRADO
El primer intento de Agenda metió un calendario ajeno (widget con colores dorados/beige fuera de paleta, que además no funcionaba en desktop). **Sustituido reutilizando el calendario custom de RESERVAR CITA (cliente)**, que ya lleva el diseño de πίστη (motor de luz LED, verde acento, Space Mono, fechas en local sin bug UTC) y funciona en desktop+móvil.
- **Refactor:** el calendario de reservar-cita se extrajo a **componente reutilizable parametrizable** (props para día seleccionado, callback, y qué días deshabilitar / rango). Reservar-cita pasa sus restricciones (ventana 30 días, cerrados, sin horario, aperturas); la Agenda NO pasa ninguna (todos los días seleccionables, pasado y futuro).
- **Verificado que reservar-cita (camino crítico del cliente) sigue funcionando idéntico** tras el refactor: misma ventana, mismos días deshabilitados. No se rompió el flujo de reserva.

### 🆕 Backend — Fase 4 · DASHBOARD · ENDPOINT DE ESTADÍSTICAS CERRADO (falta frontend)
Endpoint único `GET /admin/stats` (gateado `solo_admin`) que devuelve TODAS las métricas del dashboard en un solo objeto, calculadas/agregadas EN BACKEND con `COUNT` en BD (NO traer filas y contar en Python — la razón por la que se rechazó agregar en frontend). Zona horaria Europe/Madrid coherente (helper existente, no `date.today()` sin tz).
- **Métricas:** barbería (citas_hoy solo activas, citas_semana lunes-domingo actual, clientes a vigilar = inasistencias≥3 o bloqueado); tienda (reservas_pendientes = leads sin atender, reservas_semana por creada_en); transversal (pendientes_atencion). Shape de respuesta cerrado y documentado (el contrato para el frontend).
- **Cada métrica filtra por el estado correcto** (citas_hoy NO cuenta canceladas; reservas_pendientes solo estado='pendiente'). Tests por métrica con datos sembrados + gating solo_admin (403) + caso "hoy" en Europe/Madrid.
- **PENDIENTE: el FRONTEND del dashboard** (pintar las tarjetas de métricas + atajos: cada métrica clicable lleva a su sección — reservas_pendientes → /admin/reservas, citas_hoy → /admin/citas, etc.). Es el siguiente trozo; el contrato del endpoint ya está fijado.

---

## Decisiones abiertas

**NINGUNA.** Las dos que quedaban están cerradas:
1. ~~**Imágenes**~~ → **CERRADA: Cloudinary.** (Flujo firmado ya implementado y probado en Trozo 2a.)
2. ~~**Dispositivo del admin**~~ → **CERRADA: Alex usa MÓVIL.** Panel admin = **layout C (foco + cajón)** de `DESIGN.md` §9 (la que aguanta en móvil). **Se descartan** los efectos que dependían de cursor/hover en el admin: **Magic Bento** y **Border Glow** (§10, "moderados solo-desktop"). El acabado premium del admin se sostiene con el sistema de luz LED (ya probado en móvil), NO con efectos de hover (§11).

---

## Plan de fases (actualizado)

> **Renumeración:** la "Fase 1" ejecutada **absorbió la Fase 1 (cimientos) + la Fase 2 (barbería)** del plan original (el backend de RM se **integró**). No existe una "Fase 2 fantasma".

- **✅ Fase 0 — Diseño:** dirección consolidada en `DESIGN.md`. CERRADA.
- **✅ Fase 1 — Cimientos + integración del backend RM:** repo combinado, auth + `Usuario` + seed compartidos, Alembic + seed verificados sobre PostgreSQL real, **127/127 tests**, `/health`, CORS, slowapi, `config.py` con `model_validator` de producción. CERRADA.
- **🟡 Fase 4 — Frontend (EN CURSO, por trozos):**
  - **✅ Trozo 1 — Motor de luz + componentes-firma:** `theme.css`, motor LED, fondo de trazos (H/V, rectos o L), nav LED (Plan A confirmado), CTA borde viajero, logo π vectorizado, iconos SVG, fuentes self-hosted. Medido en Android. **CERRADO.**
  - **✅ Trozo 2 — Cascarón + navegación:** React Router, hub + dos shells + nav contextual + banner (galería desde API), bugs responsive corregidos. **CERRADO.**
  - **✅ Logo dos variantes** (wordmark hero / symbol cabeceras). **CERRADO.**
  - **✅ Auth** (AuthContext, login/registro, rutas protegidas, escaparate abierto + acciones protegidas). **CERRADO.**
  - **✅ Metallic Paint WebGL** en el wordmark (medido en Android, se queda). **CERRADO.**
  - **✅ Interactividad móvil** (pulso respiración + `:active`). **CERRADO.**
  - **✅ Pantallas reales de TIENDA (cliente):** catálogo (público), detalle + reserva de talla (público con acción protegida), mis reservas (protegida). Patrón de estados reutilizable + `cloudinary.js` + `CtaSecondary`. **CERRADO.**
  - **✅ Perfil a ruta única `/perfil` + `SesionChip`** (chip de sesión reutilizable en toda la app; nav de mundos reducido). **CERRADO.**
  - **✅ Backend — Aperturas excepcionales** (`ExcepcionFecha` tipo `'abierto'` + `TramoApertura`; feature nueva, no en RM). 192 tests. **CERRADO.**
  - **✅ Reservar cita (barbería, cliente):** embudo en una pantalla (servicio→fecha→hora→confirmar), calendario a medida con ventana 30 días + aperturas excepcionales, manejo 409/422/403, camino crítico sin render pesado. **CERRADO.**
  - **✅ Mis citas (barbería, cliente):** estados derivados §4.7 (helper puro), dos grupos Próximas/Anteriores con jerarquía visual, cancelar con confirmación de dos pasos, cruce defensivo servicio→nombre. **Cierra TODO el dominio de cliente.** **CERRADO.**
  - **✅ Contenido real del PERFIL:** Mis datos (`GET`/`PATCH /usuarios/me`, email solo lectura) + cambio de contraseña (`PATCH /usuarios/me/password`, actual+nueva+repetir, toggle mostrar/ocultar; contraseña incorrecta=400, token sobrevive al cambio). `setUsuario` refresca el chip. **Cierra la Fase 4 del lado cliente.** **CERRADO.**
  - **✅ Panel admin — ANDAMIAJE:** ruta `/admin/*` bajo RequireAdmin, layout C (foco+cajón plegable, overlay móvil, fijo desktop), navegación agrupada (Inicio/Barbería/Tienda/Sitio) con placeholders, indicador activo LED, acceso desde SesionChip solo admin, accesibilidad del drawer. Dashboard = placeholder (necesita endpoint de stats). **CERRADO.**
  - **✅ Prendas Trozo 1** (CRUD prendas + tallas + borrado): backend `?incluir_inactivas=true` (admin) + `DELETE /prendas/{id}/permanente` (409 si reservas pendientes, cascade a históricas); frontend lista con filtro Todas/Visibles/Ocultas, form crear/editar en sub-rutas, tallas en la edición, toggle activo/inactivo optimista, borrado permanente con confirmación reforzada inline. Tests 204/404/409/403 + históricas. **CERRADO.**
  - **✅ Prendas Trozo 2a** (imágenes: subir + mostrar): Cloudinary firmado verificado 200 punta a punta; límite 8 en backend (test 8ª/9ª); sección IMÁGENES en FormPrenda (modo editar); `cloudinary.js` afinado + `onError` anti-bucle; carousel del cliente arreglado (`flex: 0 0 100%`) + swipe táctil (seco, distingue de scroll, `touch-action: pan-y`). **CERRADO.**
  - **✅ Prendas Trozo 2b** (reordenar + borrar imágenes + purga): `PUT /prendas/{id}/imagenes/orden` (bulk, patrón galería); controles ↑↓★✕ por miniatura; purga Cloudinary al borrar prenda entera (2 TODO resueltos); tests reorden/404/purga. **CERRADO.**
  - **✅ Fix lista admin** — miniatura de portada (imagen principal) en vez del placeholder gris. **CERRADO.**
  - **✅ Galería del banner (admin)** — sección `/admin/galeria`, subir/reordenar/borrar reutilizando el patrón Cloudinary de Prendas; 0 cambios de backend (Fase 3 completa); tope 12 solo-frontend; estado vacío orientado a acción. **CERRADO.**
  - **✅ Reservas de tienda (admin)** — sección `/admin/reservas`, escala de 3 niveles (pendientes/atendidas/canceladas), atender/cancelar/desatender con confirmación de dos pasos, `tel:` directo, `ReservaReadAdmin` con teléfono gateado. Backend: añadida transición desatender (atendida→pendiente) + test. **CIERRA EL DOMINIO TIENDA DEL ADMIN. CERRADO.**
  - **✅ Servicios (barbería admin):** CRUD, borrado lógico (sin físico — rompería citas), `PUT {activo:true}` reactiva, duración en select de pasos de 30, fix 422 de creación. **CERRADO.**
  - **✅ Horario (barbería admin):** tramos semanales agrupados por día (jornada partida), añadir/quitar (no editar), horas :00/:30, solape validado por backend → 409. **CERRADO.**
  - **✅ Excepciones (barbería admin):** una pantalla, cierres Y aperturas excepcionales; 409 con conteo de citas; permitir cerrar HOY; bug UTC atajado; hasta ~5 meses. Resuelto de paso el bug de migración de aperturas no aplicada en Postgres local (`alembic upgrade head`). **CERRADO.**
  - **✅ Clientes/inasistencias (barbería admin):** lista de clientes (rol='cliente'), contador solo-lectura (destaca ≥3), bloquear/desbloquear con confirmación; privacidad verificada (solo_admin, sin filtrar datos a clientes). **CERRADO.**
  - **✅ Contacto en ambos mundos:** entrada en nav de barbería + tienda, una sola pantalla compartida (no duplicada); contenido real aún bloqueado por datos de Alex. **CERRADO.**
  - **✅ Agenda/citas (barbería admin):** ver citas por día (doble cruce cliente+servicio, ambos defensivos), navegación con flechas+calendario+Hoy, no-asistida (solo pasada+activa) y cancelar (solo futura+activa) con confirmación, reutiliza estadoCita.js. **Cierra el panel de gestión (tienda + barbería).** **CERRADO.**
  - **✅ Fix Agenda — calendario reutilizado de reservar-cita:** se descartó el widget dorado ajeno; extraído el calendario de reservar-cita a componente reutilizable parametrizable (restricciones por props), verificado que reservar-cita sigue idéntico. **CERRADO.**
  - **✅ Backend Dashboard — `GET /admin/stats`:** endpoint único solo_admin, todas las métricas con COUNT en BD, Europe/Madrid coherente, shape cerrado, tests por métrica + gating. **CERRADO.**
  - **⏭️ PENDIENTE — Frontend del dashboard:** pintar las tarjetas de métricas del endpoint ya construido; cada métrica clicable como ATAJO a su sección (reservas_pendientes → /admin/reservas, citas_hoy → /admin/citas, etc.). Contrato del endpoint ya fijado.
  - **⏭️ PENDIENTE — Contacto (gestionable por Alex):** NO es pantalla estática — es MINI-FEATURE con backend (modelo editable + endpoints + sección admin, como la galería). Alex gestiona el contenido desde su pestaña "Contacto" del admin. UNA sola pantalla compartida barbería+tienda con un único juego de datos (dirección fija del local + zonas de desplazamiento de la tienda + teléfono/horario/redes — útil que barbería muestre las zonas para ofrecer "corte + desplazamiento"). BLOQUEADO: falta que Alex diga qué campos quiere y si son fijos o añadibles.
- **✅ Fase 3 — Módulo Tienda + Galería del banner (CERRADA):** modelos `Prenda` + `TallaPrenda` + `ImagenPrenda` + `ReservaPrenda` + `GaleriaFoto`; CRUD catálogo (admin, disponibilidad por talla); endpoints de catálogo y reserva (lead + aviso Telegram); "Mis reservas" (cliente) y gestión (admin); galería gestionable (modelo con orden, CRUD + reorder); subida firmada a Cloudinary (firma restrictiva, guarda URL + `public_id`). **174/174 tests.** CERRADA.
- **⏭️ Fase 5 — Despliegue (Render):** web + Postgres + static (+ crons: recordatorio diario y opcional purga_citas, cada uno con su Environment Group). `.onrender.com` primero, luego dominio propio + DNS (Cloudflare). Añadir las env vars de Cloudinary (`sync:false`).

---

## Reutilización / arrastre desde RM

- **`BackendBarberia.md`**: contrato de verificación del backend de barbería.
- **`scripts/recordatorio_diario.py`** → Cron Job Render en Fase 5.
- **`scripts/purga_citas.py`**: retención RGPD (idempotente, `--dry-run`, 5 tests). Opcional como Cron en Fase 5.
- **Lecciones ya pagadas**: zona horaria Europe/Madrid coherente (test "para hoy"); migraciones que endurecen constraints fallan con datos que las incumplen; env vars por servicio en Render (`sync:false` no se heredan); centralizar constantes; el pre-deploy fallido no tumba la versión viva.
- **Notas de entorno local**: `postgresql-x64-18` local compite con Docker por el 5432 → pararlo antes de `docker compose up -d`.

---

## Cómo se trabaja (metodología)

Ver `METODOLOGIA.md`. Resumen: dirección de diseño cerrada en `DESIGN.md` → planificación/revisión en el chat web (arquitecto/revisor) → ejecución en Claude Code (Plan Mode: propone plan → se revisa aquí → se aprueba → codifica con tests). `CLAUDE.md` = constitución; `BackendBarberia.md` = plano de citas; `DESIGN.md` = verdad del diseño; este `ESTADO_PROYECTO.md` = memoria entre sesiones. Fases pequeñas y verificables; honestidad por encima de validación; suposiciones peligrosas marcadas explícitas.

**Verificación de frontend = visual, no unit test:** `npm run build` → `npm run preview` → `cloudflared tunnel --url http://localhost:4173` en Android de gama media real. Mide suavidad de efectos, NO carga "como producción".

---

## Siguiente paso

**Todo el lado cliente cerrado** + **panel admin de GESTIÓN completo** (tienda + barbería, todas las secciones). Queda el frontend del dashboard, Contacto (bloqueado por Alex) y la Fase 5. Cero decisiones bloqueantes para el dashboard.

1. **➡️ FRONTEND DEL DASHBOARD** (`/admin/resumen`) — pintar las métricas del endpoint `GET /admin/stats` (YA construido, contrato fijado). Tarjetas con las cifras (citas hoy/semana, clientes a vigilar, reservas pendientes/semana, pendientes de atención), diseño con el motor de luz LED (no vanity — accionable). **Cada métrica es un ATAJO clicable** a su sección: reservas_pendientes → `/admin/reservas`, citas_hoy → `/admin/citas`, clientes a vigilar → `/admin/clientes`, etc. Reutiliza el patrón de estados (Cargando/Error). Una sola llamada al endpoint. Con esto el panel admin queda 100% completo (salvo Contacto).
2. **Contacto (mini-feature gestionable por Alex)** — BLOQUEADO por Alex (falta que diga qué campos quiere y si son fijos o añadibles). NO es pantalla estática: es feature con backend (modelo editable + endpoints + sección admin, como la galería). Una sola pantalla compartida barbería+tienda, un único juego de datos (local fijo de barbería + zonas de desplazamiento de tienda + teléfono/horario/redes). Cuando Alex responda, se diseña como trozo propio.
3. **Fase 5 — Despliegue (Render):** web + Postgres + static + crons (recordatorio diario; opcional purga_citas; futura purga_prendas). Env vars de Cloudinary (`sync:false`). `.onrender.com` primero, luego dominio + DNS (Cloudflare). Cada cron con su Environment Group. **Recordar:** el pre-deploy debe incluir `alembic upgrade head`.

**Feature V1.1 (post-despliegue) — EMAILS A CLIENTES:** anotada, NO para el piloto. Tres disparadores: (a) recordatorio 24h antes de la cita de barbería → **cron programado** (patrón ya resuelto en RM: el recordatorio diario a Alex; adaptar para email al cliente); (b) al crear una reserva de ropa → **BackgroundTask reactivo** (patrón ya montado: hoy avisa a Alex por Telegram, añadir email al cliente); (c) al ATENDER una reserva de ropa → mismo patrón reactivo. **Piezas nuevas necesarias:** proveedor de email transaccional (SendGrid/Resend/Mailgun/SES — elegir con búsqueda de precios ACTUALIZADA, no de memoria; verificación de dominio SPF/DKIM; secretos en env vars), plantillas HTML, helper de envío tipo `enviar_aviso_peluquero` pero para clientes. **RGPD:** tratar con cuidado — el recordatorio de cita (que el cliente pidió) suele estar cubierto por interés legítimo; el aviso de reserva de ropa roza lo comercial → revisar consentimiento. Ojo redacción del "reserva atendida": no confundir al cliente sobre si la compra está cerrada (el cierre es en persona). **Cambio de alcance consciente:** BackendBarberia dice que en V1 las notificaciones van al peluquero, nunca al cliente — esto lo cruza a propósito, como evolución V1.1.

**Recordatorios sueltos:** URLs reales de redes de Alex en el banner (hoy `href="#"`); categorías de prenda controladas si Alex las confirma (hoy string libre); purga masiva de prendas huérfanas en Cloudinary queda para Fase 5 (`# TODO: purga_prendas`); filtro por prenda en Reservas admin = mejora futura; buscador/paginación en Clientes = mejora futura si crece el volumen; resetear contador de inasistencias = no implementado (no hay caso de uso hoy).
