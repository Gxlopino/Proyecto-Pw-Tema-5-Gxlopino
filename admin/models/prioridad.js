import { make, D, db, S, T, I, B } from "./base.js";
const Prioridad = make("prioridades", {
  codigo: S,
  nombre: S,
  orden: I,
  color: S,
  horas: I,
});
export default Prioridad;
