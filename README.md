# Mesa de ayuda del campus Tema 5

Conserva las pantallas y navegación del proyecto principal `Gxlopino/Proyecto-Pw-Tema5` y añade persistencia PostgreSQL, sesiones y API Express. Esta versión se publica en `Gxlopino/Proyecto-Pw-Tema-5-Gxlopino` para copiar el código del backend.

## Estructura

- `admin/controllers/`: controladores de vistas usuario, técnico y supervisor.
- `admin/configs/routes.js`: rutas de los tres roles con autorización del servidor.
- `website/controllers/visitante_controllers.js`: landing, acceso, salida y cuenta pública.
- `website/configs/routes.js`: rutas de visitante.
- `website/routes/campus.js`: API autenticada de cuenta, catálogo, tickets y atención.
- `website/services/`: validaciones, permisos, transacciones y reglas de negocio.
- `website/models/index.js` y `website/repositories/campus.js`: modelos y consultas autorizadas.
- `configs/database.js`: conexión PostgreSQL por variables del entorno.
- `db/migrations/`, `db/schema.sql` y `db/seed/seed.json`: esquema y datos iniciales.
- `src/`: frontend de visitante, usuario, técnico y supervisor.
- `app.js`, `server.js`, `api/index.js` y `vercel.json`: ejecución local y en Vercel.

Se retiraron los ejemplos de países, jugadores, equipos y los componentes de plantilla sin uso. Las páginas de los roles conservan el código del principal; las entradas cargan el snapshot de API antes de renderizar y el contexto actualiza los datos. El texto de recuperación informa que el operador entrega el enlace; no simula envío de correo.

## Instalación local

```bash
npm ci
npm run build
npm run configure
```

En Supabase abrir Connect → Session pooler y usar su host y usuario reales. `configure` solicita ambos y la contraseña de forma oculta. No subir `.env`. Usar una clave aleatoria de al menos 32 caracteres para SESSION_SECRET. `.env.example` solo contiene marcadores.

En una base nueva y vacía ejecutar una vez:

```bash
npm run db:up
npm run db:seed
```

No ejecutar también `db/schema.sql`; documenta el esquema creado por las migraciones. No aplicar SQL de la plantilla antigua.

```bash
npm test
npm run dev
```

Las pruebas de integración crean y limpian datos de prueba. Ejecutarlas en una base de pruebas antes de introducir datos reales. El acceso del sistema usa usuarios y sesiones de Express, no Supabase Auth. La recuperación administrativa utiliza `npm run recovery:link -- CORREO` y entrega el enlace por un canal privado.

## Supabase y Vercel nuevos del equipo

Supabase: `mesa-ayuda-tema5-oficial`, referencia `fxovnzkhqnggcbncavcb`, organización Pw 26-II. Su base se configura después de copiar el código al repositorio oficial. El proyecto local usa el entorno que configure cada integrante; no se cambian credenciales automáticamente.

Vercel: `mesa-ayuda-tema5-oficial`, equipo Galopino. Vincular exclusivamente `Gxlopino/Proyecto-Pw-Tema5` cuando todas las entregas estén en master. No copiar `.vercel/` del proyecto fuente.

Configuración de build: `npm ci`, `npm run build`, salida `public`, preset Other. Las peticiones dinámicas entran por `api/index.js` y las vistas se empaquetan según `vercel.json`.

Variables privadas del servidor: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_SSL, SESSION_SECRET y NODE_ENV. Para Vercel obtener los datos de Transaction pooler y usar 6543; para migraciones y trabajo local usar Session pooler, puerto 5432. DB es la cadena de conexión de dbmate. No añadir prefijo VITE_ a credenciales. Si corresponde, configurar DB_SSL_CA_BASE64 con el certificado CA.

Después del despliegue, con la CLI de Vercel autorizada y el entorno local configurado para la misma base:

```bash
npm run verify:deployment -- https://URL-DEL-DESPLIEGUE.vercel.app
```

Nunca publicar contraseñas, `.env`, `.vercel`, cookies, sesiones, node_modules ni volcados de datos reales.
