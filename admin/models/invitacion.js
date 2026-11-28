import { make, D, db, S, T, I, B } from "./base.js";
const Invitacion = make("invitaciones", {
  nombres: S,
  apellidos: S,
  email: S,
  rol: S,
  tokenHash: S,
  invitadoPorId: I,
  estado: S,
  creadaEn: T,
  venceEn: T,
  aceptadaEn: T,
});
export default Invitacion;
