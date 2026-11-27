// server.js
import app from "./app.js";
const port = Number(process.env.PORT || 3000);
app.listen(port, (error) => {
  if (error) {
    console.error(`No se pudo iniciar el servidor en el puerto ${port}: ${error.code}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Mesa de Ayuda: http://localhost:${port}`);
});
