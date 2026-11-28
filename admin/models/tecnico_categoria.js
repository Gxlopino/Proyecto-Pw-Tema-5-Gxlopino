import { make, D, db, S, T, I, B } from "./base.js";
const TecnicoCategoria = make("tecnicos_categorias", {
  tecnicoId: I,
  categoriaId: I,
  habilitadoEn: T,
});
export default TecnicoCategoria;
