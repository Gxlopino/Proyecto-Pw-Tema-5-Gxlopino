import { make, D, db, S, T, I, B } from "./base.js";
const Especialidad = make("especialidades_declaradas", {
  usuarioId: I,
  categoriaId: I,
});
export default Especialidad;
