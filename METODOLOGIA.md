# METODOLOGÍA — Flujo de trabajo con Claude (web) + Claude Code + Claude Design

> Documento de referencia reutilizable. Cópialo en cualquier proyecto nuevo para no explicar la metodología desde cero. Resume **cómo trabajo combinando varios Claude**: el del chat web (planificación y revisión), Claude Code en el editor (ejecución) y Claude Design (diseño visual).

---

## 1. La idea en una frase

Uso **capas separadas**: una **piensa y revisa**, otra **ejecuta** y otra **diseña**. El chat web hace de arquitecto/revisor; Claude Code hace de constructor; Claude Design hace de diseñador. Nunca dejo que la capa que ejecuta tome decisiones importantes (ni de arquitectura ni de estética) sin que se hayan decidido y revisado antes.

---

## 2. Los roles

| | **Claude web (chat)** | **Claude Code (VS Code)** | **Claude Design** |
|---|---|---|---|
| **Función** | Planificar, revisar, decidir, investigar | Escribir y modificar el código | Explorar y decidir el diseño visual |
| **Qué produce** | Prompts cerrados, revisiones de planes, decisiones | Cambios reales en el repo, tests | Mockups, tokens, dirección visual |
| **Cuándo** | Antes y durante (preparar/revisar) | Después (proponer plan y ejecutar) | Fase 0, antes de construir el frontend |

**Regla de oro:** Claude Code **nunca codifica directamente**. Primero propone un plan; ese plan se revisa en el chat web; solo entonces se aprueba la ejecución. Y para lo visual, **el diseño se decide en Claude Design antes** (ver sección 5), no lo improvisa Claude Code.

---

## 3. Archivos clave del proyecto

- **`CLAUDE.md`** — Contexto del proyecto **para Claude Code**. Stack, convenciones, decisiones fijadas, reglas críticas. Es la "constitución" técnica.
- **`ESTADO_PROYECTO.md`** — Documento de **continuidad entre sesiones de chat**. Qué está hecho, en curso, qué viene y decisiones acordadas. Lo gestiono yo: cuando el chat web genera una versión nueva, la reemplazo en los ficheros del proyecto.
- **`METODOLOGÍA.md`** — Este archivo. El cómo trabajamos, no el qué construimos.
- **(Opcional, frontend) `DESIGN.md` / tokens** — Resumen del sistema de diseño salido de Claude Design (colores, tipografía, espaciados, componentes). Sirve de referencia para que Claude Code implemente fiel.

---

## 4. El ciclo de trabajo (Plan Mode)

Cada tarea o fase sigue este bucle:

1. **Definir** — En el chat web acordamos qué hay que hacer y cómo (condiciones, alcance, dudas resueltas).
2. **Generar el prompt** — El chat web redacta un **prompt cerrado y detallado en español** para una fase concreta: *Plan Mode primero, no codifiques aún, propón el plan y espera aprobación.*
3. **Pegar en Claude Code** — Pego el prompt en Claude Code (VS Code).
4. **Plan Mode** — Claude Code propone un plan **sin tocar el código todavía**.
5. **Revisar el plan** — Copio el plan de vuelta al chat web. Aquí se cazan bugs, suposiciones peligrosas, datos desactualizados, etc.
6. **Corregir o aprobar** — Si hay fallos, el chat web redacta las correcciones; si está bien, doy el OK.
7. **Ejecutar** — Claude Code codifica, con **tests por endpoint/función**.
8. **Actualizar estado** — Si la fase cierra algo importante, pido al chat web una versión nueva de `ESTADO_PROYECTO.md` y la reemplazo.

---

## 5. Diseño visual: Claude Design → Claude Code (Fase 0)

**El problema:** Claude Code es un **ejecutor excelente**, pero inventando diseño tiende a lo **genérico / de plantilla** (layouts y estilos "por defecto"). Para un acabado con personalidad (como el negro/oro premium de RM) conviene **separar el diseño de la construcción**: que el diseño lo decida una herramienta hecha para eso, y que Claude Code solo lo **implemente fiel**.

**La herramienta:** **Claude Design** (ecosistema Anthropic) — un lienzo con herramientas de diseño que itero por chat. Aquí exploro y fijo el aspecto **antes de tocar código**, fuera de los estándares a los que tira Claude Code.

**El flujo:**
1. **Diseñar en Claude Design** — describo marca, tono y pantallas; itero en el lienzo hasta tener un diseño que me convence: layout, paleta, tipografía, componentes, micro-interacciones, estados claro/oscuro.
2. **Extraer el lenguaje de diseño** — saco los **design tokens** (colores, fuentes, espaciados, radios, sombras), **capturas** de cada pantalla/componente y, si puedo, un pequeño **`DESIGN.md`** que resuma el sistema.
3. **Pasar a Claude Code como referencia cerrada** — prompt del tipo: *"Implementa EXACTAMENTE este diseño, **no inventes**; mi stack es Vite + React (JS) + CSS Modules, **sin Tailwind ni librerías de UI**; aquí tienes los tokens y las capturas."* Con Plan Mode, como siempre.
4. **Claude Code construye** fiel al diseño (eso lo hace bien) y con tests donde apliquen.

**Cómo se implementa en el frontend:**
- Los **tokens → variables CSS** en `theme.css` (la fuente de verdad del estilo).
- Las **capturas → objetivo visual** que Claude Code reproduce con **CSS Modules**.
- ⚠️ Si Claude Design (u otra herramienta) genera **código**, es **referencia, no copy-paste**: puede no encajar con mi stack (otro framework, Tailwind, etc.). La fuente de verdad es el **diseño + los tokens**, re-implementados en MI stack.
- El resultado vive en el proyecto como cualquier componente: variables en `theme.css`, estilos en CSS Modules, respetando las reglas del `CLAUDE.md` (mobile-first, `prefers-reduced-motion`, accesibilidad, tamaños mínimos).

**Dónde encaja:** es una **Fase 0 de diseño**, *antes* del ciclo de Plan Mode, cuando arranco el frontend o una pantalla nueva con peso visual. Para retoques pequeños no hace falta; para una identidad de marca o una pantalla importante, sí. El diseño aprobado alimenta luego el ciclo normal (Claude Code propone el plan para implementarlo → reviso → apruebo → codifica).

**Regla:** el diseño se **inventa con criterio en Claude Design**, se **revisa en el chat web** y se **construye fiel en Claude Code**. Cada capa hace lo que mejor sabe.

---

## 6. Principios

- **Fases pequeñas y verificables.** Nada de "hazlo todo de golpe".
- **Revisión antes de ejecutar, siempre.** Este paso ya ha cazado bugs de producción antes de que llegaran al código.
- **Diseño antes de construir.** Lo visual se decide en Claude Design, no se improvisa en Claude Code.
- **Tests por endpoint / función.** Si no hay test, no está terminado.
- **Secretos solo en variables de entorno.** Nunca en el código, ni en `render.yaml`, ni en `.env.example` (ahí van solo los nombres).
- **Scripts idempotentes y no destructivos.** Un seed que se ejecuta en cada despliegue **nunca** debe pisar datos editables por el usuario.
- **Honestidad por encima de validación.** Prefiero que el chat web me lleve la contraria con argumentos a que me dé la razón.
- **Todo en español.** Prompts, documentación y planificación.
- **Chats cortos por fase.** `ESTADO_PROYECTO.md` hace de puente entre ellos.

---

## 7. Cómo arrancar un proyecto nuevo

1. Crear el repo y añadir **`CLAUDE.md`** con: stack fijado, convenciones, roles/auth, modelo de datos, reglas críticas y "cómo trabajar (Plan Mode)".
2. Crear **`ESTADO_PROYECTO.md`** vacío o con la fase 1 planificada.
3. Copiar este **`METODOLOGÍA.md`** tal cual.
4. Si hay frontend con identidad propia: **Fase 0 de diseño en Claude Design** (sección 5) → tokens + capturas (+ `DESIGN.md`).
5. Abrir un chat web, darle contexto (o adjuntar `CLAUDE.md` y `ESTADO_PROYECTO.md`) y empezar por **definir la fase 1**.
6. Aplicar el ciclo del punto 4 fase a fase.

---

## 8. Cómo arrancar y cerrar una sesión de chat

**Al abrir un chat nuevo:** asegurarme de que el chat web tiene el `ESTADO_PROYECTO.md` y el `CLAUDE.md` actuales. Eso le da todo el contexto sin reexplicar.

**Al cerrar:** si se ha avanzado algo relevante, pedir una versión actualizada de `ESTADO_PROYECTO.md` y reemplazarla en el proyecto.

---

## 9. Buenas prácticas aprendidas (lecciones reales)

- **El plan de Claude Code se revisa SIEMPRE antes de aprobar.** Ha evitado seeds que pisaban contraseñas, planes de BD inválidos en `render.yaml`, y problemas de driver/esquema en `DATABASE_URL`.
- **Separar diseño de construcción.** Claude Design decide el aspecto (fuera de los estándares de Claude Code); Claude Code lo implementa fiel. El código generado por herramientas de diseño es **referencia, no copy-paste**.
- **No te fíes de los precios o datos "de memoria".** Para cualquier dato de mercado o precio actual, el chat web debe **buscar en la web**.
- **Una sola base de código, funciones conmutables.** Si quieres ofrecer versiones (sencilla/pro), una sola app con funciones que se encienden o apagan por cliente.
- **Lo que inviertes en construir una vez se amortiza en todos los proyectos siguientes.** Tu tiempo de desarrollo es inversión de producto, no coste por cliente.
- **Verifica antes de desplegar.** Validar configuraciones (`render.yaml`) y desplegar primero en URLs por defecto antes de tocar dominios y DNS.
- **Coherencia de zona horaria y migraciones cuidadosas.** Toda lógica de fecha/hora en la misma zona y en todos los endpoints; las migraciones que endurecen constraints fallan si hay datos que los incumplen → limpiar antes.

---

*AceitunoDev — metodología de trabajo. Revísalo y adáptalo según el proyecto.*
