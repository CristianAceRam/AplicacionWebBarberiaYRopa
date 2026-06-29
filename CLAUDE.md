# CLAUDE.md — Web Barbería + Tienda de Ropa · πίστη (cliente: Alex)

> Constitución técnica del proyecto **para Claude Code**. Léelo antes de generar o modificar código y respeta todas las decisiones.
>
> Acompañan a este archivo: **`BackendBarberia.md`** (plano/contrato de verificación del backend de citas, reutilizado de RM), **`DESIGN.md`** (fuente de verdad del diseño), **`ESTADO_PROYECTO.md`** (continuidad entre sesiones) y **`METODOLOGIA.md`** (cómo se trabaja).

---

## Contexto

Web combinada para **Alex**, que tiene **barbería** y **marca de ropa πίστη**, en una sola aplicación con cascarón compartido. Dos dominios:
- **Barbería**: gestión de citas (idéntica a RM).
- **Tienda — "reserva sencilla"**: catálogo de prendas; el cliente **reserva una talla**, Alex recibe un **aviso por Telegram** y **cierra la venta en persona**. **Sin pago online. Disponibilidad manual.**

Desarrollador único (AceitunoDev). **Mobile-first, responsive.** Mismo dueño (Alex) para ambos negocios: un solo admin gestiona barbería y tienda.

> **Estado:** el backend de barbería **ya está integrado** desde RM (no se reconstruye; ver `BackendBarberia.md` como contrato de verificación). La Fase 0 de diseño está cerrada (`DESIGN.md`). Próximo build: tienda + galería del banner. Ver `ESTADO_PROYECTO.md`.

---

## Stack (fijado)

- Backend: FastAPI (Python). Frontend: React + Vite (**JavaScript**, no TS), **CSS Modules** (sin Tailwind ni librerías de UI). BD: PostgreSQL.
- ORM: SQLAlchemy + Alembic. Validación: Pydantic. Auth: JWT (`Authorization: Bearer`). Rate limiting: slowapi. Tests: pytest.
- Local: PostgreSQL en Docker. Hosting: Render (Web Service de pago + PostgreSQL gestionada con backups + Static Site + Cron Jobs). Sin tiempo real.

---

## Convenciones

- Dominio en español (`Usuario`, `Cita`, `Servicio`, `Prenda`, `TallaPrenda`, `ReservaPrenda`…). Secretos solo en variables de entorno.
- Cada endpoint nuevo con su test pytest. Esquemas de entrada y salida separados. Rutas literales antes que rutas con parámetro.
- **Routers separados por dominio**: barbería (`/servicios`, `/horario`, `/disponibilidad`, `/citas`, `/excepciones`) y tienda (`/prendas`, `/reservas`, y el contenido gestionable del banner). No mezclar la lógica de los dos dominios.

---

## Roles y autenticación (COMPARTIDO)

Reutilizado de RM (ver `BackendBarberia.md` §5):
- **admin** (Alex, dueño de barbería Y tienda): 2 cuentas fijas por seed, sin registro público.
- **cliente**: se registra él mismo (mismo registro para barbería y/o tienda).
- `POST /login` (solo token) + `GET /usuarios/me` (datos+rol). Registro valida nombre, **teléfono** (contacto clave para que Alex llame por una reserva), email único, password ≥8 bcrypt.
- Dependencias: `get_usuario_actual`, `solo_admin`. Seed CREATE-IF-MISSING (no pisa contraseñas) — **idempotencia verificada**.

---

## Modelo de datos

### Compartido
- **Usuario**: id, email (único), password_hash, telefono, nombre_completo, rol ('admin'|'cliente'), bloqueado (bool), inasistencias (int — solo barbería).

### Barbería (IDÉNTICO a RM — ver `BackendBarberia.md` §3 y §4)
- **Servicio**, **HorarioPeluquero**, **Cita**, **FranjaOcupada** (`UNIQUE(fecha,hora)`), **ExcepcionFecha**. Franjas 30 min, servicios múltiplos de 30 ≤300, ventana 30 días, Europe/Madrid coherente. **No reimplementar de memoria: seguir el plano.**

### Tienda — "reserva sencilla"
- **Prenda**: id, nombre, descripcion, precio (Decimal), categoria (opc.), imagenes (**ver decisión abierta**), activo (bool, borrado lógico / publicada en catálogo).
- **TallaPrenda**: id, prenda_id (FK), talla (string: "S"/"M"/"L"/"XL"/"Única"…), `disponible` (bool, lo gestiona Alex). `UNIQUE(prenda_id, talla)`.
- **ReservaPrenda**: id, cliente_id (FK), prenda_id (FK), talla (string, la elegida), estado ('pendiente'|'atendida'|'cancelada'), creada_en (timestamp).
- **NO hay `stock` entero.** La disponibilidad es **por talla** (`TallaPrenda.disponible`), bandera manual de Alex, **no stock en tiempo real**.

### Banner del hub — contenido gestionable (ver `DESIGN.md` §8)
- **Galería** (fotos de peluquería + prendas): **gestionable por Alex** con **orden** (añadir/quitar/reordenar). Modelo con campo de posición; CRUD admin + lectura pública. Comparte la **subida de imágenes** con la tienda (misma decisión abierta).
- **Redes sociales**: **estáticas (en código)**, sin backend. No modelar.

---

## Reglas de negocio

### Barbería
Las de RM, sin cambios. Ver `BackendBarberia.md` §4 (no-solape transaccional → 409, disponibilidad por servicio, ventana 30 días, días cerrados con prioridad, cancelación que libera franjas, inasistencias + bloqueo, estados derivados **sin "Confirmada"**: Reservada / Realizada / Cancelada / No asistió).

### Tienda — "reserva sencilla"
- **La reserva es un LEAD, no un bloqueo de stock.** Reservar una talla crea una `ReservaPrenda` 'pendiente' + **aviso Telegram a Alex** (nombre, teléfono, prenda, talla); **NO** descuenta nada (sin `UNIQUE`/transacción de no-solape). Alex cierra en persona.
- El cliente solo reserva una talla con `disponible=true`. **Varios clientes PUEDEN reservar la misma talla** (intencional en "sencilla"; Alex resuelve por orden/contacto).
- **Catálogo autogestionado** por Alex (CRUD de prendas, borrado lógico con `activo`, marcar tallas disponibles).
- Cliente: ve catálogo (`activo=true`), reserva una talla, ve "Mis reservas", cancela una `pendiente`. Admin: ve/gestiona reservas (marcar `atendida`/`cancelada`), gestiona catálogo y disponibilidad por talla.
- **Aviso honesto a Alex**: `disponible` es bandera manual suya, no stock automático. Si no la mantiene al día, un cliente puede reservar algo agotado. El panel debe dejar claro que él mantiene esos flags.
- RGPD: minimización; el teléfono se usa solo para contactar por la reserva.

---

## Constantes (barbería; `app/constants.py`)

`FRANJA_MINUTOS = 30`, `DURACION_MAX_MINUTOS = 300`, `DIAS_MAX_RESERVA = 30`. Zona horaria **Europe/Madrid** en TODA la lógica de fecha/hora (ver `BackendBarberia.md` §8 — bug conocido). La tienda no usa franjas ni ventana.

---

## Notificaciones (Telegram, a Alex)

Patrón de RM (helper que silencia errores, secretos en env vars):
- **Barbería**: al reservar/cancelar cita (instantáneo) + **recordatorio diario a las 22:00 (cron) — INCLUIDO** (decisión tomada; Fase 5, con su propio Environment Group).
- **Tienda**: al crear una `ReservaPrenda` (instantáneo) → nombre, teléfono, prenda y talla.

---

## Seguridad (OWASP)

Igual que RM (ver `BackendBarberia.md` §7): control de acceso por objeto, `cliente_id` del token (nunca del body), validación Pydantic, ORM parametrizado, HTTPS/HSTS, rate limiting en `/login`, `/registro`, `POST /citas` y `POST /reservas`, 500 genéricos, no registrar datos personales. `allowed_origins` con `model_validator` que falla en producción si quedan orígenes localhost.

---

## Frontend (React + Vite) — seguir `DESIGN.md`

**El diseño es fuente cerrada: implementar fiel `DESIGN.md`, no inventar.** Stack: Vite + React (JS) + CSS Modules, sin Tailwind ni librerías de UI. Tokens de `DESIGN.md` §4–§6 → `theme.css`. Mobile-first, responsive, `prefers-reduced-motion`, foco visible, toque ≥44px.

- **Arquitectura de navegación (cliente):** hub (Nivel 0) con **dos secciones — Barbería · Tienda — + banner de Alex**; **sin atajo** entre mundos (se cruza por el hub). Nivel 1: Barbería = modelo A (vertical, reservar domina), Tienda = modelo B (carriles); **nav contextual por mundo** (Barbería: mis citas · reservar · perfil; Tienda: catálogo · mis reservas · contacto · perfil).
- **Nav = panel translúcido** (cristal + borde LED): inferior en móvil, lateral en desktop. Plan B si `backdrop-filter` no rinde.
- **Sistema de luz LED** (motor único), **dark-only**, verde solo acento, esquinas angulares, contención por luz. Ver `DESIGN.md` §3–§6.
- **Banner**: dos cintas (galería gestionable + redes estáticas) en direcciones opuestas; ver `DESIGN.md` §8.
- **Efectos**: React Bits como **referencia, no copy-paste** (reimplementar en CSS Modules); respetar el mapa de coste y el presupuesto de rendimiento de `DESIGN.md` §10. Vigilar Metallic Paint (logo) y `backdrop-filter` (nav) en móvil real.
- **Panel admin unificado**: agenda/servicios/horario/días cerrados/clientes + catálogo/tallas/reservas + galería del banner. Disposición **pendiente** del dispositivo de Alex.

---

## Decisiones abiertas (a confirmar con Alex)

1. **Imágenes** — URLs externas vs. subida a almacenamiento (Cloudinary). Afecta a **catálogo de tienda** Y **galería del banner** (Alex sube fotos en ambos → probablemente Cloudinary). **Bloquea** el modelo `Prenda` y la galería. Empezar simple y dejarlo conmutable.
2. **Dispositivo del admin** — móvil vs. ordenador. Decide la disposición del panel admin (ver `DESIGN.md` §9).

> Ya resueltas (no reabrir): tallas con disponibilidad **por talla** (sin stock entero); recordatorio diario **incluido**; identidad de marca **πίστη** (ver `DESIGN.md`); **sin atajo** Barbería↔Tienda; redes del banner **estáticas**, galería **gestionable**; **dark-only**.

---

## Cómo trabajar (Claude Code)

- **Plan Mode primero**: propón el plan, espera aprobación (en el chat web), luego codifica.
- **Barbería**: sigue `BackendBarberia.md` como **contrato de verificación** (ya integrado; no reinventar de memoria).
- **Frontend**: implementa fiel `DESIGN.md` (no improvises diseño).
- Fases pequeñas y verificables. Tests pytest por endpoint. Nunca secretos en el código (ni en `render.yaml` ni en `.env.example`: ahí solo los nombres). **Marca explícitamente las suposiciones peligrosas.** Si algo no está claro, pregunta antes de inventar.
