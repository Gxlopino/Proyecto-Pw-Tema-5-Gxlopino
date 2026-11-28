import { make, D, db, S, T, I, B } from "./base.js";
const Recuperacion = make("tokens_recuperacion", {
  usuarioId: I,
  tokenHash: S,
  creadoEn: T,
  venceEn: T,
  usadoEn: T,
});
export default Recuperacion;
