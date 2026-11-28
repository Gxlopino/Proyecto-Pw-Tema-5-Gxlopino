# Arquitectura de Mesa de ayuda

La estructura sigue el proyecto de clases: modelos individuales, APIs, controladores, servicios, repositorios y configuración del área administrativa se encuentran en admin. website contiene exclusivamente el controlador y las rutas de vistas públicas.

El flujo de datos es: src/services → /api → admin/configs/api_routes.js → admin/apis → admin/services → admin/models y admin/repositories → PostgreSQL. Los servicios mantienen las validaciones, transacciones y controles de pertenencia del ticket. Los modelos se definen individualmente y admin/models/index.js declara las relaciones una sola vez.

app.js configura sesión PostgreSQL, verifica usuario y versión de sesión, monta la API y las rutas de vistas. admin/configs/routes.js conserva las rutas de React y llama a los controladores de usuario, técnico y supervisor. website/configs/routes.js llama a visitante_controllers.js para las páginas públicas.

El frontend conserva los archivos del principal salvo src/services, que sustituye los datos simulados por peticiones reales. No se cambian páginas, entradas, estilos, widgets ni AuthContext. El punto de conexión api.client.js carga el snapshot antes de que se ejecuten las entradas originales y lo refresca después de las operaciones.

server.js inicia Express localmente y api/index.js lo exporta para Vercel. Las variables de entorno contienen la conexión a PostgreSQL. Las dos migraciones de db/migrations crean las tablas y las restricciones. La semilla se carga explícitamente con scripts/seed.js. El despliegue no ejecuta migraciones.

El frontend original muestra mensajes de envío de recuperación; el backend no incluye un proveedor de correo. Mientras se configure, el operador debe generar y entregar el enlace mediante scripts/recovery.js. No se declara implementado el envío automático.
