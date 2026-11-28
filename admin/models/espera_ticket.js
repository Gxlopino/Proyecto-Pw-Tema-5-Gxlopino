import { make, D, db, S, T, I, B } from "./base.js";
const Espera = make("esperas_ticket", {
  ticketId: I,
  motivo: D.TEXT,
  fechaRetorno: T,
  inicioEn: T,
  finEn: T,
});
export default Espera;
