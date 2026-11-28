import { make, D, db, S, T, I, B } from "./base.js";
const Cierre = make("tickets_cierres", {
  ticketId: { type: I, unique: true },
  solucion: D.TEXT,
  resueltoEn: T,
  cerradoEn: T,
  tiempoAtencionMin: I,
});
export default Cierre;
