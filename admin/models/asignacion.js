import { make, D, db, S, T, I, B } from "./base.js";
const Asignacion = make("asignaciones", {
  ticketId: I,
  tecnicoId: I,
  asignadoPorId: I,
  tipo: S,
  motivo: S,
  nota: D.TEXT,
  creadoEn: T,
});
export default Asignacion;
