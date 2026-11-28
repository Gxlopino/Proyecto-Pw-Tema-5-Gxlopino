import { make, D, db, S, T, I, B } from "./base.js";
const CambioPrioridad = make("cambios_prioridad", {
  ticketId: I,
  anterior: S,
  nueva: S,
  motivo: S,
  autorId: I,
  creadoEn: T,
});
export default CambioPrioridad;
