import { make, D, db, S, T, I, B } from "./base.js";
const Ticket = make("tickets", {
  codigo: {
    type: S,
    defaultValue: db.literal(
      "('TCK-'||extract(year FROM now())::text||'-'||lpad(nextval('ticket_codigo_seq')::text,5,'0'))",
    ),
  },
  asunto: S,
  descripcion: S,
  categoriaId: I,
  subcategoriaId: I,
  ambienteId: I,
  solicitanteId: I,
  tecnicoId: I,
  prioridad: S,
  prioridadSugerida: S,
  estado: S,
  creadoEn: T,
  venceEn: T,
  tiempoEsperaMin: I,
});
export default Ticket;
