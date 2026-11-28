import { db } from "./base.js";
import Prioridad from "./prioridad.js";
import Estado from "./estado_ticket.js";
import Unidad from "./unidad.js";
import Sede from "./sede.js";
import Ambiente from "./ambiente.js";
import Categoria from "./categoria.js";
import Usuario from "./usuario.js";
import TecnicoCategoria from "./tecnico_categoria.js";
import Especialidad from "./especialidad_declarada.js";
import Invitacion from "./invitacion.js";
import Recuperacion from "./token_recuperacion.js";
import Ticket from "./ticket.js";
import Cierre from "./ticket_cierre.js";
import Espera from "./espera_ticket.js";
import Reapertura from "./reapertura.js";
import Bitacora from "./bitacora_entrada.js";
import Historial from "./historial_estado.js";
import Asignacion from "./asignacion.js";
import CambioPrioridad from "./cambio_prioridad.js";

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


export { db, Prioridad, Estado, Unidad, Sede, Ambiente, Categoria, Usuario, TecnicoCategoria, Especialidad, Invitacion, Recuperacion, Ticket, Cierre, Espera, Reapertura, Bitacora, Historial, Asignacion, CambioPrioridad };
