import { make, D, db, S, T, I, B } from "./base.js";
const Categoria = make("categorias", {
  nombre: S,
  parentId: I,
  prioridadDefecto: S,
  tiempoEsperadoHoras: I,
  descripcion: S,
  activa: B,
  creadaEn: T,
});
export default Categoria;
