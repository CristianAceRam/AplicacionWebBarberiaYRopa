# CLAUDE.md — Web Barbería + Tienda de Ropa ([CLIENTE])

> Archivo de contexto del proyecto para Claude Code. Léelo antes de generar o modificar código y respeta todas las decisiones. Documento de arranque: algunas decisiones están marcadas como **[POR DEFINIR]**.

> Acompaña a este archivo el **`BackendBarberia.md`** (plano completo del backend de citas, reutilizable de RM). El módulo de barbería de este proyecto se construye **a partir de ese plano**.

---

## Contexto

Web combinada para un **cliente concreto** que tiene **barbería** y **marca de ropa**, en una sola aplicación con cascarón compartido. Dos dominios:
- **Barbería**: gestión de citas (idéntica a RM).
- **Tienda de ropa — "Reserva sencilla"**: catálogo de prendas; el cliente **reserva** una prenda, el vendedor recibe un **aviso por Telegram** y **cierra la venta en persona**. **Sin pago online. Stock manual.**

Desarrollador único (AceitunoDev). **Mobile-first**, responsiva. Mismo dueño para ambos negocios (un solo admin gestiona barbería y tienda).

---

## Stack (fijado)

- Backend: FastAPI (Python). Frontend: React + Vite (**JavaScript**, no TS). BD: PostgreSQL.
- ORM: SQLAlchemy + Alembic. Validación: Pydantic. Auth: JWT (cabecera `Authorization: Bearer`). Rate limiting: slowapi. Tests: pytest.
- Local: PostgreSQL en Docker. Hosting: Render (Web Service de pago + PostgreSQL gestionada con backups + Static Site + Cron Job si hace falta).
- Sin tiempo real.

---

## Convenciones

- Dominio en español (`Usuario`, `Cita`, `Servicio`, `Prenda`, `Reserva`…). Secretos solo en variables de entorno.
- Cada endpoint nuevo con su test pytest. Esquemas de entrada y salida separados. Rutas literales antes que rutas con parámetro.
- **Routers separados por dominio**: barbería (`/servicios`, `/horario`, `/disponibilidad`, `/citas`, `/excepciones`) y tienda (`/prendas`, `/reservas`). No mezclar la lógica de los dos dominios.

---

## Roles y autenticación (COMPARTIDO entre ambos dominios)

Reutilizar tal cual el modelo de RM (ver `BackendBarberia.md` §5):
- **admin** (el dueño del negocio: gestiona barbería Y tienda): 2 cuentas fijas por seed, sin registro público.
- **cliente**: se registra él mismo (mismo registro para usar barbería y/o tienda).
- `POST /login` (solo token) + `GET /usuarios/me` (datos+rol). Registro valida nombre, teléfono (contacto del cliente — clave para que el vendedor le llame por una reserva de prenda), email único, password ≥8 bcrypt.
- Dependencias: `get_usuario_actual`, `solo_admin`. Seed CREATE-IF-MISSING (no pisa contraseñas).

---

## Modelo de datos

### Compartido
- **Usuario**: `id`, `email` (único), `password_hash`, `telefono`, `nombre_completo`, `rol` ('admin' | 'cliente'), `bloqueado` (bool), `inasistencias` (int — solo relevante para barbería).

### Barbería (IDÉNTICO a RM — ver `BackendBarberia.md` §3 y §4)
- **Servicio**, **HorarioPeluquero**, **Cita**, **FranjaOcupada** (`UNIQUE(fecha,hora)`), **ExcepcionFecha** (días cerrados). Franjas de 30 min, servicios múltiplos de 30 ≤300, ventana de reserva 30 días, todo con la zona horaria Europe/Madrid coherente. **No reimplementar de memoria: seguir el plano.**

### Tienda de ropa — "Reserva sencilla" (NUEVO)
- **Prenda**: `id`, `nombre`, `descripcion`, `precio` (Decimal), `categoria` (opcional), `tallas` ([POR DEFINIR]: texto/lista de tallas disponibles, o sin tallas en V1), `imagenes` ([POR DEFINIR]: ver "Decisiones abiertas"), `stock` (int, **gestión manual del admin**) o `disponible` (bool), `activo` (bool — borrado lógico / publicada en catálogo).
- **ReservaPrenda**: `id`, `cliente_id` (FK Usuario), `prenda_id` (FK), `talla` (opcional, la elegida), `estado` ('pendiente' | 'atendida' | 'cancelada'), `creada_en` (timestamp). Es un **lead**: el cliente expresa interés, el vendedor lo cierra en persona.

---

## Reglas de negocio

### Barbería
Las de RM, sin cambios. Ver `BackendBarberia.md` §4 (no-solape transaccional → 409, disponibilidad por servicio, ventana de 30 días, días cerrados con prioridad, cancelación que libera franjas, inasistencias + bloqueo, estados derivados sin "Confirmada").

### Tienda — "Reserva sencilla"
- **La reserva es un LEAD, no un bloqueo de stock.** Reservar una prenda crea una `ReservaPrenda` en estado `pendiente` y **avisa al vendedor por Telegram**; NO descuenta stock automáticamente (a diferencia de la barbería, aquí no hay `UNIQUE`/transacción de no-solape). El vendedor cierra la venta **en persona** y gestiona el stock **a mano**.
- Varios clientes PUEDEN reservar la misma prenda (el vendedor resuelve por orden/contacto). Esto es intencional en "sencilla".
- **Catálogo autogestionado** por el admin (CRUD de prendas, borrado lógico con `activo`, edición de stock manual).
- El cliente: ve el catálogo (prendas `activo=true`), reserva una prenda (crea `ReservaPrenda` + aviso), ve "Mis reservas", puede cancelar una reserva `pendiente`.
- El admin: ve/gestiona las reservas (marcar `atendida` / `cancelada`), gestiona el catálogo y el stock manual.
- RGPD: minimización; el teléfono del cliente se usa solo para contactarle por la reserva.

---

## Constantes (barbería; centralizar en `app/constants.py`)

`FRANJA_MINUTOS = 30`, `DURACION_MAX_MINUTOS = 300`, `DIAS_MAX_RESERVA = 30`. Zona horaria **Europe/Madrid** en TODA la lógica de fecha/hora (ver `BackendBarberia.md` §8 — bug ya conocido). La tienda no usa franjas ni ventana.

---

## Notificaciones (Telegram, al dueño)

Reutilizar el patrón de RM (helper que silencia errores, secretos en env vars). Avisos al dueño:
- **Barbería**: al reservar/cancelar cita (instantáneo) + **recordatorio diario** opcional a las 22:00 (cron) — [POR DEFINIR si se incluye en este proyecto].
- **Tienda**: al crear una `ReservaPrenda` (instantáneo) → nombre del cliente, teléfono, prenda (y talla), para que el vendedor le contacte.

---

## Seguridad (OWASP)

Igual que RM (ver `BackendBarberia.md` §7): control de acceso por objeto, `cliente_id` del token (nunca del body), validación Pydantic, ORM parametrizado, HTTPS/HSTS, rate limiting en `/login`, `/registro`, `POST /citas` y `POST /reservas`, 500 genéricos, no registrar datos personales.

---

## Frontend (React + Vite)

- **Cascarón compartido** con navegación entre **Barbería** (reservar cita) y **Tienda** (catálogo + reservar prenda), y un **panel admin unificado** con ambos dominios (agenda/servicios/horario/días cerrados/clientes + catálogo/reservas de prenda).
- Mobile-first, responsiva. AuthContext + rutas por rol. Cliente HTTP centralizado (Bearer, 401/409).
- **Catálogo de tienda**: rejilla de prendas con foto, nombre, precio; ficha de prenda; botón "Reservar" (crea la reserva + feedback). "Mis reservas" para el cliente.

### Diseño visual — [POR DEFINIR en Fase 0 con Claude Design]
- **NO** reutilizar el negro/oro de RM. Identidad **nueva**, con **colores distintos** y un acabado mejor.
- Definir en **Claude Design** (ver `METODOLOGIA.md` §5): paleta, tipografía, componentes, modo claro/oscuro, micro-interacciones → tokens + capturas + `DESIGN.md`, que Claude Code implementa fiel (CSS Modules, sin Tailwind, mobile-first, `prefers-reduced-motion`).
- Marca/nombre del cliente: **[POR DEFINIR]**.

---

## Decisiones abiertas (resolver al planificar)

1. **Imágenes de las prendas**: ¿URLs externas que pega el admin, o subida a almacenamiento de objetos (Cloudinary / S3 / disco de Render)? Para el piloto, empezar por lo más simple y dejarlo conmutable.
2. **Tallas/variantes**: ¿la prenda tiene tallas (S/M/L) que el cliente elige al reservar, o sin tallas en V1?
3. **Stock manual**: ¿`stock` (int editable) o `disponible` (bool)? Decidir el más simple para "sencilla".
4. **Recordatorio diario de barbería**: ¿se incluye en este proyecto o no?
5. **Identidad de marca**: nombre, paleta, logo (Fase 0 de diseño).

---

## Cómo trabajar (Claude Code)

- Plan Mode primero: propón el plan, espera aprobación, luego codifica.
- **Para el módulo de barbería, sigue `BackendBarberia.md` como spec** (no lo reinventes de memoria).
- Fases pequeñas y verificables. Tests pytest por endpoint. Nunca secretos en el código. Si algo no está claro, pregunta antes de inventar.
