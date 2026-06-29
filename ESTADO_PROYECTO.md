# Estado del proyecto — πίστη (Web Barbería + Tienda de Ropa · cliente: Alex)

> Documento de continuidad. Léelo junto a `CLAUDE.md`, `BackendBarberia.md`, `METODOLOGIA.md` y `DESIGN.md` para retomar el proyecto en cualquier chat.

> **ESTADO ACTUAL: 🟢 FASE 1 (backend) CERRADA · 🟢 FASE 0 (diseño) CERRADA.** Próximo build real: Fase 3 (tienda + galería), bloqueada parcialmente por la decisión de imágenes de Alex; en paralelo, Fase 4 (frontend) ya tiene su dirección en `DESIGN.md`.

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
- **Tallas + disponibilidad por talla** (cambio respecto al planteamiento inicial): el cliente elige talla y ve **disponible / no disponible**; Alex marca la disponibilidad a mano.
  - **`Prenda`**: id, nombre, descripcion, precio, categoria (opc.), imagenes (pend.), activo.
  - **`TallaPrenda`**: id, prenda_id (FK), talla (S/M/L/Única…), `disponible` (bool). `UNIQUE(prenda_id, talla)`.
  - **`ReservaPrenda`**: id, cliente_id, prenda_id, talla, estado ('pendiente'|'atendida'|'cancelada'), creada_en.
  - **NO hay `stock` entero** — `disponible` es bandera manual, no stock en tiempo real.
- **Auth/usuarios compartidos**: un solo `Usuario` con rol; Alex (admin) gestiona ambos dominios; el cliente se registra una vez.

### Diseño (Fase 0 — ver `DESIGN.md`)
- **Dirección consolidada en el chat web** (se prescinde de Claude Design: tiraba a plantilla y su salida exigía re-traducción al stack). Identidad y tokens buenos del pase anterior reaprovechados.
- **Sistema de luz LED** como pieza-firma (motor único: fondo de pulsos LED + indicador de nav que viaja + bordes que se encienden + CTA + logo). Neón blanco = luz de marca; verde = línea-acento.
- **Dark-only** (sin modo claro). Verde **solo acento**, nunca cuerpo. Contraste AA verificado. Esquinas angulares; contención por luz, no por caja redondeada.
- **Tipografía**: wordmark graffiti + script del lema como **SVG** (no fuente); **Hanken Grotesk** (sans UI/cuerpo) + **Space Mono** (datos).
- **Arquitectura de navegación del cliente**: hub (Nivel 0) con **dos secciones (Barbería · Tienda) + banner de Alex**; **sin atajo** Barbería↔Tienda (se cruza por el hub). Nivel 1: Barbería = modelo A (vertical), Tienda = modelo B (carriles), **nav contextual por mundo**.
- **Nav = panel translúcido** (cristal con borde LED), inferior en móvil / lateral en desktop (responsive). Plan B si `backdrop-filter` no rinde en móvil.
- **Banner de Alex** (en el hub), dos cintas en direcciones opuestas:
  - **Redes sociales**: estática (en código), sin backend; al pulsar se detiene para clicar. Los cambios puntuales los hace el desarrollador a mano.
  - **Galería de fotos** (peluquería + prendas): **gestionable por Alex** (añadir/quitar/**reordenar**) → mini-feature con backend; comparte la subida de imágenes con la tienda.
- **Efectos (React Bits como referencia, no se instala)**: triados por coste; presupuesto de rendimiento definido. Calibración con `build` + `vite preview` + `cloudflared` en Android real. Vigilar: Metallic Paint del logo (shader en bucle) y `backdrop-filter` del nav.

---

## Decisiones abiertas (a confirmar con Alex; no bloquean el diseño)

1. **Imágenes de Alex** — URLs pegadas vs. subida a Cloudinary. Afecta a **catálogo de tienda (Fase 3)** Y **galería del banner**. Si Alex sube fotos en ambos (galería con orden + catálogo), apunta a **Cloudinary con subida directa**, pero lo confirma él. **Bloquea** el modelo `Prenda` y la galería.
2. **Dispositivo del admin** — móvil vs. ordenador. Decide la disposición del panel admin (3 opciones sobre la mesa: bento / eje / foco+cajón; el bento depende de cursor/desktop).

---

## Plan de fases (actualizado)

> **Renumeración:** la "Fase 1" ejecutada **absorbió la Fase 1 (cimientos) + la Fase 2 (barbería)** del plan original, porque el backend de RM se **integró** en vez de reconstruirse. Por eso el siguiente build real es la Fase 3. **No existe una "Fase 2 fantasma".**

- **✅ Fase 0 — Diseño:** dirección consolidada en `DESIGN.md`. CERRADA.
- **✅ Fase 1 — Cimientos + integración del backend RM:** repo combinado, estructura `backend/` + `frontend/`, auth + `Usuario` + seed compartidos, Alembic + seed verificados sobre PostgreSQL real, **127/127 tests** (baseline y final, sin regresiones), `/health`, CORS, slowapi, `config.py` con `model_validator` de producción para `allowed_origins`. CERRADA.
- **⏭️ Fase 3 — Módulo Tienda + Galería del banner:** modelos `Prenda` + `TallaPrenda` + `ReservaPrenda`; CRUD de catálogo (admin, disponibilidad por talla); endpoints de catálogo y de reserva (lead + aviso Telegram); "Mis reservas" (cliente) y gestión (admin); **galería gestionable** (modelo con orden, CRUD, subida de imágenes). Tests. **Bloqueada por la decisión de imágenes (#1).**
- **⏭️ Fase 4 — Frontend:** cascarón + arquitectura de navegación del cliente (hub + dos mundos + banner), dashboards por dominio, panel admin unificado, implementación fiel de `DESIGN.md` (sistema de luz LED, nav translúcido, efectos calibrados). Mobile-first, responsive.
- **⏭️ Fase 5 — Despliegue (Render):** web + Postgres + static (+ crons: **recordatorio diario** y opcional **purga_citas**, cada uno con su **Environment Group**, porque los `sync:false` no se heredan). Estrategia: `.onrender.com` primero, luego dominio propio + DNS (Cloudflare).

---

## Reutilización / arrastre desde RM

- **`BackendBarberia.md`**: contrato de verificación del backend de barbería (no se recodifica de memoria).
- **`scripts/recordatorio_diario.py`**: conservado → Cron Job Render en Fase 5.
- **`scripts/purga_citas.py`**: script de retención RGPD (borra citas y franjas anteriores a `RETENCION_MESES`, def. 24; idempotente, `--dry-run`, 5 tests). Opcional como Cron Job en Fase 5.
- **Lecciones ya pagadas**: zona horaria Europe/Madrid coherente (con test "para hoy"); migraciones que endurecen constraints fallan con datos que las incumplen; env vars por servicio en Render (`sync:false` no se heredan); centralizar constantes; el pre-deploy fallido no tumba la versión viva.
- **Notas de entorno local**: el servicio `postgresql-x64-18` local compite con Docker por el puerto 5432 → pararlo antes de `docker compose up -d`. `.env` saneado (sin credenciales/Telegram de RM). venvs de RM borrados y recreados limpios.

---

## Cómo se trabaja (metodología)

Ver `METODOLOGIA.md`. Resumen: dirección de diseño cerrada en `DESIGN.md` (ya no en Claude Design) → planificación/revisión en el chat web (arquitecto/revisor) → ejecución en Claude Code (Plan Mode: propone plan → se revisa aquí → se aprueba → codifica con tests). `CLAUDE.md` = constitución técnica; `BackendBarberia.md` = plano del módulo de citas; `DESIGN.md` = fuente de verdad del diseño; este `ESTADO_PROYECTO.md` = memoria entre sesiones. Fases pequeñas y verificables; honestidad por encima de validación; suposiciones peligrosas se marcan explícitas.

---

## Siguiente paso

1. **Cerrar con Alex** las dos decisiones abiertas: **imágenes** (desbloquea Fase 3 + galería) y **dispositivo del admin** (desbloquea la disposición del admin).
2. Con la decisión de imágenes cerrada: **Fase 3 (tienda + galería)** en Claude Code, Plan Mode → revisión aquí → ejecución con tests.
3. **Fase 4 (frontend)** siguiendo `DESIGN.md`, en trozos pequeños (primero sistema de luz + componentes-firma: nav LED, botón, logo), revisando en preview sobre un móvil real.
