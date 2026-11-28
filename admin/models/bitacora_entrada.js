import { make, D, db, S, T, I, B } from "./base.js";
const Bitacora = make("bitacora_entradas", {
  ticketId: I,
  autorId: I,
  tipo: S,
  texto: S,
  creadoEn: T,
});
export default Bitacora;
