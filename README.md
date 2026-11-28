# Mesa de ayuda del campus Tema 5

Frontend original: Gxlopino/Proyecto-Pw-Tema5. Copia con backend: Gxlopino/Proyecto-Pw-Tema-5-Gxlopino.

## Estructura del backend como en el proyecto de clases

- admin/models: un archivo Sequelize por entidad; index.js reúne modelos y relaciones.
- admin/apis: cuenta_api, usuario_api, catalogo_api, cola_api y atencion_api. Reciben las peticiones y llaman a servicios.
- admin/controllers: controladores de vistas de usuario, técnico y supervisor; sesion_controllers gestiona respuestas JSON y persistencia de sesión.
- admin/services: cuenta_services, catalogo_services y tickets_services contienen las reglas de negocio y transacciones; common.js reúne validaciones comunes.
- admin/repositories/mesa_repositories.js: consultas y snapshot autorizado por rol.
- admin/configs/routes.js: rutas de las vistas de cada rol. api_routes.js registra la API bajo /api. database.js comparte la misma conexión del servidor.
- website/controllers/visitante_controllers.js y website/configs/routes.js: vistas públicas de visitante, acceso y salida.
- configs/database.js: conexión PostgreSQL por variables de entorno; los middlewares verifican sesión y permisos.
- db/migrations, db/schema.sql y db/seed/seed.json: tablas, restricciones y datos iniciales.
- app.js, server.js, api/index.js y vercel.json: ejecución local y Vercel.

## Frontend

Las páginas, widgets, estilos, parciales, contexto y entradas de src son los mismos del master del principal. Solo src/services cambia para consultar el backend real. api.client.js espera la carga inicial de /api/bootstrap antes de ejecutar las entradas originales; las operaciones refrescan el snapshot. No se usa localStorage como base de datos.

## Configuración local

```bash
npm ci
npm run build
npm run configure
```

En Supabase → Connect → Session pooler obtener el host y el usuario postgres.REFERENCIA reales. configure pide ambos y la contraseña oculta. Nunca versionar .env. SESSION_SECRET necesita un secreto aleatorio de al menos 32 caracteres. .env.example contiene solo marcadores.

Sobre una base NUEVA y vacía:

```bash
npm run db:up
npm run db:seed
npm test
npm run dev
```

No ejecutar también schema.sql: documenta las tablas creadas por las migraciones. Las pruebas crean y limpian datos de prueba; ejecutarlas antes de introducir datos reales. El acceso usa Express y las tablas de PostgreSQL; no requiere Supabase Auth. La herramienta recovery:link genera el enlace de recuperación administrativo. El envío automático de correo queda pendiente de configurar un proveedor; no está implementado.

## Proyectos nuevos del equipo

Supabase mesa-ayuda-tema5-oficial, referencia fxovnzkhqnggcbncavcb, organización Pw 26-II. Vercel mesa-ayuda-tema5-oficial, equipo Galopino, vinculado al repositorio principal Gxlopino/Proyecto-Pw-Tema5. Esta copia se publica en el otro repositorio para que el equipo copie los archivos del backend.

No copiar .env ni .vercel entre proyectos. Cada copia local usa las credenciales que se configuren expresamente; subir código no cambia la conexión local ni aplica migraciones automáticamente.

## Vercel

Preset Other; instalación npm ci; compilación npm run build; salida public. api/index.js exporta app.js. vercel.json empaqueta las vistas y dirige las peticiones dinámicas a Express.

Variables privadas: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_SSL, SESSION_SECRET, NODE_ENV; opcionalmente DB_SSL_CA_BASE64. Para Vercel usar los datos reales de Transaction pooler, puerto 6543; para migraciones locales Session pooler, 5432. DB es la cadena privada que usa dbmate. No poner prefijo VITE_ a secretos. No ejecutar migraciones durante el build.

Con la CLI autorizada y la copia local configurada con la misma base, verificar el despliegue nuevo mediante:

```bash
npm run verify:deployment -- https://URL-NUEVA.vercel.app
```

Nunca publicar credenciales, .env, .vercel, node_modules, cookies, sesiones o volcados de datos reales.
