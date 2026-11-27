<!-- README.md -->
# Tema 5 · Mesa de ayuda de servicios del campus

Implementación HU-1 a HU-5: React/Vite → Express → servicios → modelos/repositorio Sequelize → PostgreSQL en Supabase.

## Ejecutar

Node 22 o posterior. En PowerShell:

```powershell
cd 'D:\Progra-web\Proyecto final'
npm ci
# Solo en una instalación nueva; solicita contraseña oculta:
npm run configure
npm run db:up
npm run db:seed
npm run dev
```

Abrir http://localhost:3000. Alternativa: `npm run build` y `npm start`. `npm test` ejecuta pruebas reales con datos ficticios propios y los elimina. `npm run docs:model` regenera el modelo desde PostgreSQL. La semilla omite la carga si ya existen usuarios para conservar cambios.

## Acceso de prueba

Contraseña para las tres cuentas: **SoloPruebas2026!**, respetando mayúsculas/minúsculas.

| Rol        | Correo ficticio                 |
| ---------- | ------------------------------- |
| Usuario    | camila.quispe@aloe.ulima.edu.pe |
| Técnico   | jparedes@ulima.edu.pe           |
| Supervisor | lmendoza@ulima.edu.pe           |

Se cargaron 16 usuarios, 23 tickets, 27 categorías/subcategorías y 12 ambientes. Las contraseñas se almacenan con bcrypt, nunca en texto plano.

## Supabase y Antares

Proyecto `mesa-ayuda-tema5`, organización `Pw 26-II`, región `us-east-1`, referencia `cgkpbwvhojwavlsnmpsi`. PrograWeb26 es la contraseña

| Campo                          | Valor real no sensible              |
| ------------------------------ | ----------------------------------- |
| Host Session pooler            | aws-2-us-east-1.pooler.supabase.com |
| Puerto local, dbmate y Antares | 5432                                |
| Usuario                        | postgres.cgkpbwvhojwavlsnmpsi       |
| Base                           | postgres                            |
| SSL                            | Requerido                           |

Antares: **Nueva conexión → PostgreSQL → completar campos → activar SSL (Require) → Test → Guardar → esquema public → tablas**. Introducir la contraseña original de PostgreSQL, sin codificar como URL. La conexión de red y las tablas están comprobadas; la conexión manual en Antares corresponde al usuario.

`.env` está ignorado por Git. El asistente configura `DB` con usuario y contraseña codificados para URL y `DB_PASS` con el valor original entre comillas. Para actualizarlo después de rotar la contraseña: `npm run configure -- --update`. No enviar secretos al chat.

## Vercel

URL: https://mesa-ayuda-tema5.vercel.app

Equipo `galopino`, proyecto `prj_U5erNzfemA2f78kzGNobCUvOojRc`. Se desplegó desde la carpeta local sin publicar Git. Vercel Authentication permanece habilitado: la visita puede pedir acceso a Vercel antes del login propio de la aplicación. Las pruebas HTTP usaron `vercel curl` autenticado.

Variables exactas de servidor configuradas en production y preview:

| Variable       | Valor o propósito                    |
| -------------- | ------------------------------------- |
| DB_NAME        | postgres                              |
| DB_USER        | postgres.cgkpbwvhojwavlsnmpsi         |
| DB_PASS        | Contraseña original, secreta         |
| DB_HOST        | aws-2-us-east-1.pooler.supabase.com   |
| DB_PORT        | 6543, Transaction pooler              |
| DB_SSL         | true                                  |
| SESSION_SECRET | Secreto aleatorio exclusivo de Vercel |
| NODE_ENV       | production                            |

Opcional: `DB_SSL_CA_BASE64`, CA descargada de Supabase en base64 para verificar la identidad TLS. Sin ella se usa SSL cifrado compatible con la referencia (`rejectUnauthorized: false`). Pool máximo por instancia: 2 conexiones Sequelize y 2 de sesiones. No se usan prepared statements con nombre ni estado de sesión para consultas. Vercel no necesita `DB` de dbmate ni `PORT`. No se exponen secretos en variables `VITE_*`.

```powershell
npm exec --yes --package=vercel -- vercel login
# Desde el proyecto vinculado; transfiere variables por stdin sin mostrarlas:
npm run vercel:env
npm run build
npm exec --yes --package=vercel -- vercel deploy --prod --yes --scope team_WXL6qKsjPwAepNetjndewhi8
npm run verify:deployment
```

`api/index.js` exporta la misma aplicación Express; `server.js` escucha en local. Vercel ejecuta Vite, sirve `public/` y empaqueta EJS. Las migraciones se ejecutan con dbmate manualmente, nunca por petición. `public/dist/` no se versiona.

## Referencia e integración

La referencia separa configuración Sequelize en `configs/database.js`, rutas, APIs/controladores, servicios y modelos; React consume endpoints Express y Vite genera estáticos. dbmate obtiene la conexión de `DB`. Se conserva esta arquitectura con `website/routes/campus.js`, `controllers/campus.js`, `services/`, `repositories/campus.js` y `models/index.js`.

Las diferencias necesarias son bcrypt, tokens SHA-256, sesiones PostgreSQL con versión para revocarlas y transacciones con bloqueo de ticket. Las sesiones en archivos temporales no eran compartidas entre instancias de Vercel. El frontend conserva sus vistas; sus contadores usan una instantánea autorizada en memoria desde la API. No importa el seed ni guarda datos de negocio en localStorage. Cada escritura refresca esa instantánea y hay refresco auxiliar cada 30 segundos.

Se compararon el destino `23b4e28` y el original local `576c3d5`, integrando el frontend más avanzado sin modificar el origen ni la referencia. Las migraciones/dump de fútbol se conservaron en `db/legacy-template/`, fuera de las migraciones activas. El historial del destino se conserva.

## Modelo: problemas corregidos y decisiones

- Migraciones ajenas al tema: archivadas; se aplicaron dos migraciones propias con dbmate.
- Estado y prioridad usan códigos con FK; los valores fijos usan CHECK. Los catálogos conservan ID y código único.
- Subcategoría de otro padre: validada en el servicio y mediante FK compuesta `(subcategoria_id,categoria_id)`. El servicio limita las categorías a dos niveles y evita ciclos y cambios de nivel de categorías utilizadas.
- Se añadieron horas de referencia, sesiones, versión de sesión y campos de bloqueo. Los tokens de invitación y recuperación se guardan mediante hash.
- Cierre, solución, esperas y reaperturas están normalizados en tablas propias; la API compone los datos que muestran las pantallas. Fechas `timestamptz` y presentación local.
- Nombre de categoría único por padre, ignorando mayúsculas; email único normalizado; código de ambiente único global. Pabellón es atributo del ambiente porque no tiene datos independientes en estas HU.
- RESTRICT conserva referencias de auditoría; CASCADE elimina detalles dependientes del ticket; SET NULL se utiliza en referencias opcionales del perfil. Se añadieron índices de lectura y las 14 FK señaladas por el asesor.
- La prioridad efectiva inicial es la predeterminada de la subcategoría; la sugerencia queda separada. El tiempo esperado depende de la subcategoría y no cambia al priorizar. Las esperas desplazan el vencimiento.
- Cerrar desde atención registra resuelto y después cerrado. La interfaz admite regresar de resuelto a atención. Reabrir requiere motivo y un cierre de hasta siete días. Cancelar requiere que el ticket nunca haya sido asignado, incluso si vuelve a la cola.
- Sin envío real de correo, la recuperación pública responde de forma genérica. El operador verifica la identidad y ejecuta `npm run recovery:link` para entregar un enlace privado de un solo uso. No se expone un token al solicitante anónimo ni se simula un correo enviado.
- Todas las tablas públicas tienen RLS y permisos revocados a `anon`/`authenticated`; solo Express accede a PostgreSQL. El aviso INFO de RLS sin políticas es intencional: no se usa el Data API ni se crean políticas públicas permisivas.

El `.puml` se genera desde PostgreSQL. `docs/modelo-validado.json` incluye columnas, nulabilidad, defaults, CHECK, claves e índices. `db/schema.sql` refleja las migraciones sin datos ni secretos.

## Endpoints

Respuesta común: `{success,message,data,error}`. El actor se toma de la sesión; el servidor verifica rol y propiedad del ticket.

| Grupo         | Rutas                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuenta        | POST /api/v1/registro, /api/v1/login, /api/v1/logout; GET /api/v1/sessions; PUT /api/v1/cuenta y /api/v1/cuenta/password                              |
| Invitaciones  | POST /api/v1/invitaciones; GET /api/v1/invitaciones/:token; POST .../:token/aceptar y .../:token/rechazar                                             |
| Recuperación | POST /api/v1/recuperar; GET /api/v1/recuperar/:token; POST /api/v1/restablecer                                                                        |
| Auxiliares    | GET /api/bootstrap, /api/v1/unidades, /api/v1/registro/disponible                                                                                     |
| Catálogo     | GET/POST /api/admin/categorias, /sedes y /ambientes; PUT/DELETE .../:id; GET /categorias/:id; PUT /categorias/:id/estado; GET/PUT /tecnico-categorias |
| Tickets       | GET/POST /api/website/tickets; GET /tickets/duplicado y /tickets/:codigo; POST .../:codigo/informacion, /cancelar y /reabrir                          |
| Asignación   | GET /api/admin/cola; POST /cola/:codigo/asignar, /cola/lote/asignar, /cola/devolver y /cola/prioridad                                                 |
| Técnicos     | GET /api/admin/bandeja, /bandeja/disponibles y /bandejas; POST /bandeja/:codigo/tomar                                                                 |
| Atención     | GET/POST /api/admin/tickets/:codigo/bitacora; GET .../historial; POST .../estado y .../cerrar                                                         |
| Salud         | GET /healthz                                                                                                                                          |

## Verificado y pendiente

Verificado: instalación y build, dos migraciones dbmate contra Session pooler, semillas y relaciones; 10 pruebas de integración aprobadas; flujo completo HTTP en Vercel contra Transaction pooler con páginas, estilos/JS/imagen, registro, tres roles, sesión, escritura, asignación, estado, notas internas ocultas, cierre y logout. Se eliminaron datos y cookies temporales. Consulta final: 16 usuarios, 23 tickets, 0 usuarios temporales y 0 tablas públicas sin RLS. Consulta reciente de registros Vercel: sin errores de servidor.

La revisión visual local comprobó el login, la cola con datos reales y el panel de sedes. No constituye una auditoría visual exhaustiva de todas las pantallas ni de accesibilidad. Antares se configura manualmente, como se solicitó.

Pendientes reales:

1. Rotar la contraseña nueva de PostgreSQL: Supabase la dejó visible tras el cambio y apareció en una lectura del navegador. No se guardó en código ni documentación. Después: `npm run configure -- --update`, `npm run vercel:env`, redesplegar y actualizar Antares.
2. Rotar la contraseña expuesta del antiguo proyecto S13 si sigue activo.
3. Revisión manual del proyecto antes de preparar o publicar commits. No se ejecutaron operaciones de staging, commits ni push. `origin` apunta exclusivamente a https://github.com/Gxlopino/Proyecto-Pw-Tema-5-Gxlopino.git . Tras la confirmación explícita se publicarán commits por etapa, sin fuerza, y se conectará Git con Vercel si corresponde.
4. Para compartir con personas ajenas al equipo, revisar el acceso de Vercel Authentication. Los permisos propios de la aplicación están implementados por separado.

Fuentes: [Supabase: conexión PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Vercel: configuración](https://vercel.com/docs/project-configuration/vercel-json), [Aviso RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
