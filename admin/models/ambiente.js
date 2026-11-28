import { make, D, db, S, T, I, B } from "./base.js";
const Ambiente = make("ambientes", {
  sedeId: I,
  codigo: S,
  tipo: S,
  nombre: S,
  pabellon: S,
  piso: I,
  capacidad: I,
  activo: B,
});
export default Ambiente;
