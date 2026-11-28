# Arquitectura de Mesa de ayuda

El servidor Express se crea en app.js. server.js abre el puerto local y api/index.js exporta la aplicación para Vercel. Las sesiones se guardan en PostgreSQL y el servidor verifica usuario, rol y versión de sesión en cada petición.

## Rutas y controladores

`website/configs/routes.js` usa `website/controllers/visitante_controllers.js` para las páginas públicas. `admin/configs/routes.js` usa los controladores de usuario, técnico y supervisor; `configs/middlewares.js` impide entrar a otro rol. Se conservan las rutas de React del proyecto principal.

`website/routes/campus.js` publica la API bajo /api y llama a los servicios accounts, catalog y tickets. `website/controllers/campus.js` genera respuestas y gestiona la sesión. Los servicios consultan modelos Sequelize y usan transacciones y restricciones PostgreSQL. `website/repositories/campus.js` filtra el snapshot según el rol.

## Frontend

Las páginas, parciales, estilos y widgets siguen el proyecto principal. Las cuatro entradas esperan la carga inicial de /api/bootstrap. AuthContext consulta la sesión y refresca los datos. Los servicios de src/services llaman a la API; no guardan tickets ni credenciales en localStorage ni cargan la semilla directamente al navegador.

## Persistencia y despliegue

Las migraciones de db/migrations crean el esquema y sus reglas. scripts/seed.js carga datos de prueba de db/seed/seed.json. configs/database.js obtiene la conexión exclusivamente del entorno. Las vistas EJS y el frontend compilado se sirven junto con Express. No se inicia una migración durante el build de Vercel.

## Colaboración

El principal permanece en Gxlopino/Proyecto-Pw-Tema5. Esta copia preparada se publica en Gxlopino/Proyecto-Pw-Tema-5-Gxlopino. Para llevar los archivos al principal se usan ramas por integrante y pull requests hacia master. No copiar .git, .env o .vercel entre proyectos.
