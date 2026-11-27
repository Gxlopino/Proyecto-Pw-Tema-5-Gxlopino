// website/models/index.js
import { DataTypes as D } from "sequelize";
import db from "../../configs/database.js";
const snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const make = (table, fields) =>
  db.define(
    table,
    Object.fromEntries(
      Object.entries({
        id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
        ...fields,
      }).map(([key, value]) => [
        key,
        { ...(value.type ? value : { type: value }), field: snake(key) },
      ]),
    ),
    { tableName: table, timestamps: false },
  );
const S = D.STRING,
  T = D.DATE,
  I = D.INTEGER,
  B = D.BOOLEAN;
export const Prioridad = make("prioridades", {
  codigo: S,
  nombre: S,
  orden: I,
  color: S,
  horas: I,
});
export const Estado = make("estados_ticket", {
  codigo: S,
  nombre: S,
  color: S,
  esFinal: B,
});
export const Unidad = make("unidades", { nombre: S });
export const Sede = make("sedes", { nombre: S, direccion: S, activa: B });
export const Ambiente = make("ambientes", {
  sedeId: I,
  codigo: S,
  tipo: S,
  nombre: S,
  pabellon: S,
  piso: I,
  capacidad: I,
  activo: B,
});
export const Categoria = make("categorias", {
  nombre: S,
  parentId: I,
  prioridadDefecto: S,
  tiempoEsperadoHoras: I,
  descripcion: S,
  activa: B,
  creadaEn: T,
});
export const Usuario = make("usuarios", {
  nombres: S,
  apellidos: S,
  email: S,
  passwordHash: S,
  telefono: S,
  unidadId: I,
  vinculo: S,
  rol: S,
  estado: S,
  motivoBloqueo: S,
  intentosFallidos: I,
  bloqueadoHasta: T,
  ambienteHabitualId: I,
  creadoEn: T,
  ultimoAcceso: T,
  sessionVersion: I,
});
export const TecnicoCategoria = make("tecnicos_categorias", {
  tecnicoId: I,
  categoriaId: I,
  habilitadoEn: T,
});
export const Especialidad = make("especialidades_declaradas", {
  usuarioId: I,
  categoriaId: I,
});
export const Invitacion = make("invitaciones", {
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
export const Recuperacion = make("tokens_recuperacion", {
  usuarioId: I,
  tokenHash: S,
  creadoEn: T,
  venceEn: T,
  usadoEn: T,
});
export const Ticket = make("tickets", {
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
export const Cierre = make("tickets_cierres", {
  ticketId: { type: I, unique: true },
  solucion: D.TEXT,
  resueltoEn: T,
  cerradoEn: T,
  tiempoAtencionMin: I,
});
export const Espera = make("esperas_ticket", {
  ticketId: I,
  motivo: D.TEXT,
  fechaRetorno: T,
  inicioEn: T,
  finEn: T,
});
export const Reapertura = make("reaperturas", {
  ticketId: I,
  autorId: I,
  motivo: D.TEXT,
  creadoEn: T,
});
export const Bitacora = make("bitacora_entradas", {
  ticketId: I,
  autorId: I,
  tipo: S,
  texto: S,
  creadoEn: T,
});
export const Historial = make("historial_estados", {
  ticketId: I,
  estadoAnterior: S,
  estadoNuevo: S,
  autorId: I,
  motivo: D.TEXT,
  permanenciaMin: I,
  creadoEn: T,
});
export const Asignacion = make("asignaciones", {
  ticketId: I,
  tecnicoId: I,
  asignadoPorId: I,
  tipo: S,
  motivo: S,
  nota: D.TEXT,
  creadoEn: T,
});
export const CambioPrioridad = make("cambios_prioridad", {
  ticketId: I,
  anterior: S,
  nueva: S,
  motivo: S,
  autorId: I,
  creadoEn: T,
});
Ambiente.belongsTo(Sede, { foreignKey: "sedeId" });
Categoria.belongsTo(Categoria, { as: "parent", foreignKey: "parentId" });
Usuario.belongsTo(Unidad, { foreignKey: "unidadId" });
for (const [key, model] of Object.entries({
  categoriaId: Categoria,
  subcategoriaId: Categoria,
  ambienteId: Ambiente,
  solicitanteId: Usuario,
  tecnicoId: Usuario,
}))
  Ticket.belongsTo(model, { as: key.replace("Id", "Ref"), foreignKey: key });
for (const model of [
  Cierre,
  Espera,
  Reapertura,
  Bitacora,
  Historial,
  Asignacion,
  CambioPrioridad,
])
  model.belongsTo(Ticket, { foreignKey: "ticketId" });
Usuario.belongsToMany(Categoria, {
  through: TecnicoCategoria,
  foreignKey: "tecnicoId",
  otherKey: "categoriaId",
});
export { db };
