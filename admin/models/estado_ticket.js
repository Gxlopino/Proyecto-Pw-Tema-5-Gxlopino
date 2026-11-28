import { make, D, db, S, T, I, B } from "./base.js";
const Estado = make("estados_ticket", {
  codigo: S,
  nombre: S,
  color: S,
  esFinal: B,
});
export default Estado;
