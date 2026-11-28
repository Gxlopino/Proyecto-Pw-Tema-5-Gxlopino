import { make, D, db, S, T, I, B } from "./base.js";
const Reapertura = make("reaperturas", {
  ticketId: I,
  autorId: I,
  motivo: D.TEXT,
  creadoEn: T,
});
export default Reapertura;
