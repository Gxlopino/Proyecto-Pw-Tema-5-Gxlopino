import { make, D, db, S, T, I, B } from "./base.js";
const Historial = make("historial_estados", {
  ticketId: I,
  estadoAnterior: S,
  estadoNuevo: S,
  autorId: I,
  motivo: D.TEXT,
  permanenciaMin: I,
  creadoEn: T,
});
export default Historial;
