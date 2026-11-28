// admin/repositories/mesa_repositories.js
import { Op } from "sequelize";
import * as M from "../models/index.js";
import { safeUser } from "../services/cuenta_services.js";
import { openStates, fullName } from "../services/common.js";
const serial = async (jobs) => {
  const results = [];
  for (const job of jobs) results.push(await job());
  return results;
};
const rows = async (model, where = {}, transaction) =>
  model.findAll({ where, raw: true, transaction, order: [["id", "ASC"]] });
export async function snapshot(user) {
  return M.db.transaction(
    { isolationLevel: "REPEATABLE READ", readOnly: true },
    async (transaction) => {
      const [prioridades, estadosTicket, units, sedes, ambientes, categorias] =
        await serial(
          [
            M.Prioridad,
            M.Estado,
            M.Unidad,
            M.Sede,
            M.Ambiente,
            M.Categoria,
          ].map((m) => () => rows(m, {}, transaction)),
        );
      const base = {
        prioridades,
        estadosTicket,
        unidades: units.map((u) => u.nombre),
        sedes,
        ambientes,
        categorias,
        usuarios: [],
        tickets: [],
        tecnicoCategorias: [],
        bitacora: [],
        historialEstados: [],
        asignaciones: [],
        cambiosPrioridad: [],
        invitaciones: [],
      };
      if (!user) return base;
      const links = await rows(M.TecnicoCategoria, {}, transaction);
      let where = {};
      if (user.rol === "usuario") where = { solicitanteId: user.id };
      if (user.rol === "tecnico")
        where = {
          [Op.or]: [
            { tecnicoId: user.id },
            {
              tecnicoId: null,
              categoriaId: {
                [Op.in]: links
                  .filter((l) => l.tecnicoId === user.id)
                  .map((l) => l.categoriaId),
              },
              estado: { [Op.in]: ["abierto", "reabierto"] },
            },
          ],
        };
      const tickets = await rows(M.Ticket, where, transaction);
      const ids = tickets.map((t) => t.id),
        ticketWhere = { ticketId: { [Op.in]: ids } };
      const [
        cierres,
        esperas,
        reaperturas,
        bitacora,
        historialEstados,
        asignaciones,
        cambiosPrioridad,
      ] = await serial(
        [
          M.Cierre,
          M.Espera,
          M.Reapertura,
          M.Bitacora,
          M.Historial,
          M.Asignacion,
          M.CambioPrioridad,
        ].map(
          (m) => () =>
            rows(
              m,
              m === M.Bitacora && user.rol === "usuario"
                ? { ...ticketWhere, tipo: "publico" }
                : ticketWhere,
              transaction,
            ),
        ),
      );
      const users = await rows(
        M.Usuario,
        user.rol === "supervisor"
          ? {}
          : {
              id: {
                [Op.in]: [
                  ...new Set(
                    [
                      user.id,
                      ...tickets.flatMap((t) => [t.solicitanteId, t.tecnicoId]),
                      ...bitacora.map((b) => b.autorId),
                      ...historialEstados.map((h) => h.autorId),
                      ...asignaciones.map((a) => a.asignadoPorId),
                      ...cambiosPrioridad.map((c) => c.autorId),
                    ].filter(Boolean),
                  ),
                ],
              },
            },
        transaction,
      );
      const specs = await rows(
        M.Especialidad,
        { usuarioId: { [Op.in]: users.map((u) => u.id) } },
        transaction,
      );
      const usuarios = users.map((u) => ({
        id: u.id,
        nombres: u.nombres,
        apellidos: u.apellidos,
        email: u.email,
        telefono: u.telefono,
        unidad: units.find((x) => x.id === u.unidadId)?.nombre || "",
        vinculo: u.vinculo,
        rol: u.rol,
        estado: u.estado,
        ambienteHabitualId: u.ambienteHabitualId,
        creadoEn: u.creadoEn,
        ultimoAcceso: u.ultimoAcceso,
        especialidades: specs
          .filter((x) => x.usuarioId === u.id)
          .map((x) => x.categoriaId),
      }));
      // Limita datos personales de terceros al nombre y rol necesarios para la trazabilidad.
      const filtered = usuarios.map((u) =>
        user.rol === "supervisor" || u.id === user.id
          ? u
          : {
              id: u.id,
              nombres: u.nombres,
              apellidos: u.apellidos,
              rol: u.rol,
              estado: u.estado,
              especialidades: [],
              telefono: user.rol === "tecnico" ? u.telefono : "",
            },
      );
      return {
        ...base,
        usuarios: filtered,
        tecnicoCategorias: user.rol === "usuario" ? [] : links,
        bitacora,
        historialEstados,
        asignaciones,
        cambiosPrioridad,
        tickets: tickets.map((t) => {
          const c = cierres.find((c) => c.ticketId === t.id),
            e = esperas.find((e) => e.ticketId === t.id && !e.finEn),
            rp = reaperturas.filter((e) => e.ticketId === t.id).at(-1),
            hist = historialEstados.filter((h) => h.ticketId === t.id);
          return {
            ...t,
            solucion: c?.solucion || null,
            resueltoEn: c?.resueltoEn || null,
            cerradoEn: c?.cerradoEn || null,
            tiempoAtencionMin: c?.tiempoAtencionMin ?? null,
            motivoEspera: e?.motivo || null,
            fechaRetorno: e?.fechaRetorno || null,
            motivoReapertura: rp?.motivo || null,
            motivoCancelacion:
              hist.find((h) => h.estadoNuevo === "cancelado")?.motivo || null,
          };
        }),
      };
    },
  );
}
export function enrich(t, s) {
  const cat = s.categorias.find((c) => c.id === t.categoriaId),
    sub = s.categorias.find((c) => c.id === t.subcategoriaId),
    a = s.ambientes.find((a) => a.id === t.ambienteId),
    seat = s.sedes.find((s) => s.id === a?.sedeId),
    u = s.usuarios.find((u) => u.id === t.solicitanteId),
    tec = s.usuarios.find((u) => u.id === t.tecnicoId);
  return {
    ...t,
    categoria: cat?.nombre || "—",
    subcategoria: sub?.nombre || "—",
    ambiente: a?.codigo || "—",
    ambienteDetalle: a
      ? `${a.nombre} · Pabellón ${a.pabellon} · piso ${a.piso} · capacidad ${a.capacidad} · ${seat?.nombre || ""}`
      : "",
    solicitante: fullName(u),
    solicitanteTelefono: u?.telefono || "—",
    tecnico: tec ? fullName(tec) : null,
    vencido:
      openStates.includes(t.estado) &&
      t.estado !== "en_espera" &&
      new Date(t.venceEn) < new Date(),
  };
}
