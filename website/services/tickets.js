// website/services/tickets.js
import { Op } from "sequelize";
import * as M from "../models/index.js";
import { snapshot, enrich } from "../repositories/campus.js";
import { requireValue as need, text, openStates, fullName } from "./common.js";
const activeAssignable = ["abierto", "reabierto", "en_atencion", "en_espera"];
export async function visibleTicket(
  key,
  user,
  { transaction, lock = false, attend = false, owner = false } = {},
) {
  const isId = /^\d+$/.test(String(key));
  const t = await M.Ticket.findOne({
    where: isId ? { id: Number(key) } : { codigo: key },
    transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  need(t, "No encontramos ese ticket.", 404);
  if (owner)
    need(
      user.rol === "usuario" && t.solicitanteId === user.id,
      "Solo el solicitante puede realizar esta operación.",
      403,
    );
  else if (attend)
    need(
      user.rol === "supervisor" ||
        (user.rol === "tecnico" && t.tecnicoId === user.id),
      "El ticket no está asignado a ti.",
      403,
    );
  else if (user.rol === "usuario")
    need(t.solicitanteId === user.id, "No tienes acceso a este ticket.", 403);
  else if (user.rol === "tecnico" && t.tecnicoId !== user.id) {
    const link = await M.TecnicoCategoria.findOne({
      where: { tecnicoId: user.id, categoriaId: t.categoriaId },
      transaction,
    });
    need(
      !t.tecnicoId && ["abierto", "reabierto"].includes(t.estado) && link,
      "No tienes acceso a este ticket.",
      403,
    );
  }
  return t;
}
export async function detail(key, user) {
  const t = await visibleTicket(key, user);
  const s = await snapshot(user);
  return enrich(
    s.tickets.find((x) => x.id === t.id),
    s,
  );
}
async function note(t, user, tipo, texto, transaction) {
  return M.Bitacora.create(
    { ticketId: t.id, autorId: user.id, tipo, texto, creadoEn: new Date() },
    { transaction },
  );
}
async function transition(t, state, user, motivo, transaction) {
  const previous = await M.Historial.findOne({
    where: { ticketId: t.id },
    order: [
      ["creadoEn", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
  await M.Historial.create(
    {
      ticketId: t.id,
      estadoAnterior: t.estado,
      estadoNuevo: state,
      autorId: user.id,
      motivo: motivo || null,
      permanenciaMin: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(previous?.creadoEn || t.creadoEn)) / 60000,
        ),
      ),
      creadoEn: new Date(),
    },
    { transaction },
  );
  await t.update({ estado: state }, { transaction });
}
export async function create(data, user) {
  need(user.rol === "usuario", "Solo los usuarios registran tickets.", 403);
  const asunto = text(data.asunto, 5, 120, "asunto"),
    descripcion = text(data.descripcion, 15, 600, "descripcion");
  const ticket = await M.db.transaction(async (transaction) => {
    const ids = [Number(data.categoriaId), Number(data.subcategoriaId)].sort(
      (a, b) => a - b,
    );
    const cats = await M.Categoria.findAll({
      where: { id: { [Op.in]: ids } },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.SHARE,
    });
    const cat = cats.find((c) => c.id === Number(data.categoriaId)),
      sub = cats.find((c) => c.id === Number(data.subcategoriaId));
    need(
      cat && !cat.parentId && cat.activa,
      "Categoría inactiva o no válida.",
      400,
      "categoriaId",
    );
    need(
      sub && sub.parentId === cat.id && sub.activa,
      "Subcategoría no válida.",
      400,
      "subcategoriaId",
    );
    const ambiente = await M.Ambiente.findByPk(Number(data.ambienteId), {
      transaction,
      lock: transaction.LOCK.SHARE,
    });
    need(ambiente?.activo, "Ambiente no válido.", 400, "ambienteId");
    const sede = await M.Sede.findByPk(ambiente.sedeId, { transaction });
    need(sede?.activa, "Sede inactiva.");
    need(
      await M.Prioridad.findOne({
        where: { codigo: data.prioridadSugerida },
        transaction,
      }),
      "Prioridad no válida.",
      400,
      "prioridadSugerida",
    );
    const ahora = new Date();
    const t = await M.Ticket.create(
      {
        asunto,
        descripcion,
        categoriaId: cat.id,
        subcategoriaId: sub.id,
        ambienteId: ambiente.id,
        solicitanteId: user.id,
        tecnicoId: null,
        prioridad: sub.prioridadDefecto,
        prioridadSugerida: data.prioridadSugerida,
        estado: "abierto",
        creadoEn: ahora,
        venceEn: new Date(+ahora + sub.tiempoEsperadoHoras * 3600000),
        tiempoEsperaMin: 0,
      },
      { transaction },
    );
    await M.Historial.create(
      {
        ticketId: t.id,
        estadoAnterior: null,
        estadoNuevo: "abierto",
        autorId: user.id,
        motivo: "Ticket registrado",
        permanenciaMin: 0,
        creadoEn: ahora,
      },
      { transaction },
    );
    return t;
  });
  return detail(ticket.codigo, user);
}
export async function duplicate(q, user) {
  const t = await M.Ticket.findOne({
    where: {
      ambienteId: Number(q.ambienteId) || 0,
      categoriaId: Number(q.categoriaId) || 0,
      estado: { [Op.in]: openStates },
    },
    order: [["creadoEn", "DESC"]],
  });
  if (!t) return null;
  return {
    codigo: t.codigo,
    asunto: "Incidencia ya reportada en este ambiente",
    estado: t.estado,
    creadoEn: t.creadoEn,
  };
}
export async function mine(q, user) {
  const s = await snapshot(user);
  return s.tickets
    .filter((t) => t.solicitanteId === user.id)
    .filter(
      (t) =>
        !q.estado ||
        (q.estado === "en_curso"
          ? openStates.includes(t.estado)
          : t.estado === q.estado),
    )
    .filter(
      (t) =>
        !q.codigo || t.codigo.toLowerCase().includes(q.codigo.toLowerCase()),
    )
    .filter((t) => !q.categoriaId || t.categoriaId === Number(q.categoriaId))
    .filter(
      (t) =>
        !q.desde ||
        new Date(t.creadoEn) >= new Date(`${q.desde}T00:00:00-05:00`),
    )
    .filter(
      (t) =>
        !q.hasta ||
        new Date(t.creadoEn) <= new Date(`${q.hasta}T23:59:59-05:00`),
    )
    .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
    .map((t) => enrich(t, s));
}
export async function information(key, user, data) {
  const value = text(data.texto, 1, 600, "texto");
  return M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      owner: true,
    });
    need(
      !["cerrado", "cancelado"].includes(t.estado),
      "El ticket ya está cerrado.",
      409,
    );
    return note(t, user, "publico", value, transaction);
  });
}
export async function cancel(key, user, data) {
  await M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      owner: true,
    });
    need(
      ["abierto", "reabierto"].includes(t.estado) && !t.tecnicoId,
      "Solo puedes cancelar antes de la asignación.",
      409,
    );
    need(
      !(await M.Asignacion.count({
        where: { ticketId: t.id, tipo: { [Op.ne]: "devolucion" } },
        transaction,
      })),
      "El ticket ya fue asignado anteriormente.",
      409,
    );
    await transition(
      t,
      "cancelado",
      user,
      data.motivo
        ? text(data.motivo, 1, 240, "motivo")
        : "Cancelado por el solicitante",
      transaction,
    );
  });
  return detail(key, user);
}
export async function reopen(key, user, data) {
  await M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      owner: true,
    });
    const c = await M.Cierre.findOne({
      where: { ticketId: t.id },
      transaction,
    });
    need(
      t.estado === "cerrado" &&
        c?.cerradoEn &&
        Date.now() - new Date(c.cerradoEn) <= 604800000,
      "Solo puedes reabrir durante los siete días posteriores al cierre.",
      409,
    );
    const motivo = text(data.motivo, 10, 600, "motivo");
    await M.Reapertura.create(
      { ticketId: t.id, autorId: user.id, motivo, creadoEn: new Date() },
      { transaction },
    );
    await transition(t, "reabierto", user, motivo, transaction);
    const cat = await M.Categoria.findByPk(t.subcategoriaId, { transaction });
    await t.update(
      { venceEn: new Date(Date.now() + cat.tiempoEsperadoHoras * 3600000) },
      { transaction },
    );
    await note(t, user, "publico", `Ticket reabierto: ${motivo}`, transaction);
  });
  return detail(key, user);
}
export async function entries(key, user) {
  const t = await visibleTicket(key, user);
  const rows = await M.Bitacora.findAll({
    where: {
      ticketId: t.id,
      ...(user.rol === "usuario" ? { tipo: "publico" } : {}),
    },
    order: [
      ["creadoEn", "ASC"],
      ["id", "ASC"],
    ],
    raw: true,
  });
  const ids = [...new Set(rows.map((b) => b.autorId))];
  const people = await M.Usuario.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "nombres", "apellidos", "rol"],
    raw: true,
  });
  return rows.map((b) => {
    const u = people.find((u) => u.id === b.autorId);
    return {
      ...b,
      autor: fullName(u),
      autorRol: u?.rol,
      autorIniciales: u ? u.nombres[0] + u.apellidos[0] : "?",
    };
  });
}
export async function addEntry(key, user, data) {
  need(["publico", "interno"].includes(data.tipo), "Tipo no válido.");
  return M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      attend: true,
    });
    need(
      !["cerrado", "cancelado"].includes(t.estado),
      "El ticket ya está cerrado.",
      409,
    );
    return note(
      t,
      user,
      data.tipo,
      text(data.texto, 1, 600, "texto"),
      transaction,
    );
  });
}
export async function state(key, user, data) {
  await M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      attend: true,
    });
    const allowed = {
      abierto: ["en_atencion"],
      reabierto: ["en_atencion"],
      en_atencion: ["en_espera", "resuelto"],
      en_espera: ["en_atencion"],
      resuelto: ["en_atencion"],
    };
    need(
      allowed[t.estado]?.includes(data.estado),
      "Transición no permitida.",
      409,
    );
    need(t.tecnicoId, "Asigna un técnico antes de iniciar la atención.", 409);
    let motivo = null;
    if (data.estado === "en_espera") {
      motivo = text(data.motivoEspera, 1, 600, "motivoEspera");
      need(
        /^\d{4}-\d{2}-\d{2}$/.test(data.fechaRetorno || ""),
        "Fecha no válida.",
        400,
        "fechaRetorno",
      );
      const fecha = new Date(`${data.fechaRetorno}T23:59:59-05:00`);
      need(
        Number.isFinite(+fecha) && fecha >= new Date(),
        "La fecha de retorno no puede ser pasada.",
        400,
        "fechaRetorno",
      );
      await M.Espera.create(
        { ticketId: t.id, motivo, fechaRetorno: fecha, inicioEn: new Date() },
        { transaction },
      );
    }
    if (t.estado === "en_espera") {
      const e = await M.Espera.findOne({
        where: { ticketId: t.id, finEn: null },
        transaction,
      });
      need(e, "Falta el registro de espera.", 409);
      const elapsed = Math.max(0, Date.now() - new Date(e.inicioEn));
      await e.update({ finEn: new Date() }, { transaction });
      await t.update(
        {
          venceEn: new Date(+new Date(t.venceEn) + elapsed),
          tiempoEsperaMin: t.tiempoEsperaMin + Math.floor(elapsed / 60000),
        },
        { transaction },
      );
    }
    if (data.estado === "resuelto") {
      await M.Cierre.upsert(
        {
          ticketId: t.id,
          resueltoEn: new Date(),
          cerradoEn: null,
          solucion: null,
          tiempoAtencionMin: null,
        },
        { transaction },
      );
    }
    if (t.estado === "resuelto" && data.estado === "en_atencion")
      await M.Cierre.destroy({ where: { ticketId: t.id }, transaction });
    await transition(t, data.estado, user, motivo, transaction);
  });
  return detail(key, user);
}
export async function close(key, user, data) {
  const solucion = text(data.solucion, 15, 600, "solucion");
  await M.db.transaction(async (transaction) => {
    const t = await visibleTicket(key, user, {
      transaction,
      lock: true,
      attend: true,
    });
    need(
      ["en_atencion", "resuelto"].includes(t.estado),
      "Solo se puede cerrar un ticket en atención o resuelto.",
      409,
    );
    const ahora = new Date();
    if (t.estado === "en_atencion")
      await transition(t, "resuelto", user, null, transaction);
    const c = await M.Cierre.findOne({
      where: { ticketId: t.id },
      transaction,
    });
    const values = {
      ticketId: t.id,
      solucion,
      resueltoEn: c?.resueltoEn || ahora,
      cerradoEn: ahora,
      tiempoAtencionMin: Math.max(
        0,
        Math.floor((ahora - new Date(t.creadoEn)) / 60000) - t.tiempoEsperaMin,
      ),
    };
    if (c) await c.update(values, { transaction });
    else await M.Cierre.create(values, { transaction });
    await transition(t, "cerrado", user, "Solución aplicada", transaction);
    await note(
      t,
      user,
      "publico",
      `Ticket cerrado. Solución: ${solucion}`,
      transaction,
    );
  });
  return detail(key, user);
}
export async function history(key, user) {
  const t = await visibleTicket(key, user);
  const s = await snapshot(user);
  const ticket = enrich(
      s.tickets.find((x) => x.id === t.id),
      s,
    ),
    hist = s.historialEstados
      .filter((h) => h.ticketId === t.id)
      .sort(
        (a, b) => new Date(a.creadoEn) - new Date(b.creadoEn) || a.id - b.id,
      ),
    name = (c) => s.estadosTicket.find((e) => e.codigo === c)?.nombre || c,
    person = (id) => fullName(s.usuarios.find((u) => u.id === id));
  const fin = ticket.cerradoEn ? +new Date(ticket.cerradoEn) : Date.now(),
    etapas = {};
  const events = hist.map((h, i) => {
    const duration = Math.max(
      0,
      (hist[i + 1] ? +new Date(hist[i + 1].creadoEn) : fin) -
        new Date(h.creadoEn),
    );
    if (!["cerrado", "cancelado"].includes(h.estadoNuevo))
      etapas[h.estadoNuevo] = (etapas[h.estadoNuevo] || 0) + duration;
    return {
      tipo: "estado",
      estado: h.estadoNuevo,
      titulo: h.estadoAnterior
        ? `${name(h.estadoAnterior)} → ${name(h.estadoNuevo)}`
        : name(h.estadoNuevo),
      detalle: [person(h.autorId), h.motivo].filter(Boolean).join(" · "),
      permanencia: ["cerrado", "cancelado"].includes(h.estadoNuevo)
        ? null
        : `Permaneció ${Math.floor(duration / 60000)} min en este estado`,
      duracion: duration,
      creadoEn: h.creadoEn,
    };
  });
  events.push(
    ...s.asignaciones
      .filter((a) => a.ticketId === t.id)
      .map((a) => ({
        tipo: "asignacion",
        titulo:
          a.tipo === "devolucion"
            ? "Devuelto a la cola"
            : `${a.tipo} a ${person(a.tecnicoId)}`,
        detalle: [person(a.asignadoPorId), a.motivo, a.nota]
          .filter(Boolean)
          .join(" · "),
        creadoEn: a.creadoEn,
      })),
    ...s.cambiosPrioridad
      .filter((a) => a.ticketId === t.id)
      .map((a) => ({
        tipo: "prioridad",
        titulo: `Prioridad ${a.anterior} → ${a.nueva}`,
        detalle: [person(a.autorId), a.motivo].join(" · "),
        creadoEn: a.creadoEn,
      })),
  );
  const total = Math.max(0, fin - new Date(t.creadoEn)),
    espera = etapas.en_espera || 0;
  return {
    ticket,
    eventos: events.sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn)),
    etapas: Object.entries(etapas).map(([estado, ms]) => ({
      estado,
      nombre: name(estado),
      ms,
    })),
    tiempos: { total, espera, atencion: Math.max(0, total - espera) },
  };
}
function sort(list, order) {
  const rank = { critica: 1, alta: 2, media: 3, baja: 4 },
    old = (a, b) => new Date(a.creadoEn) - new Date(b.creadoEn);
  return list.sort((a, b) =>
    order === "antiguedad"
      ? -old(a, b)
      : order === "prioridad"
        ? rank[a.prioridad] - rank[b.prioridad] || old(a, b)
        : order === "sin_atencion"
          ? Number(!!a.tecnicoId) - Number(!!b.tecnicoId) || old(a, b)
          : order === "plazo"
            ? rank[a.prioridad] - rank[b.prioridad] ||
              new Date(a.venceEn) - new Date(b.venceEn)
            : old(a, b),
  );
}
export async function queue(user, q = {}) {
  const s = await snapshot(user),
    states = q.estados ? q.estados.split(",") : openStates,
    priorities = q.prioridades ? q.prioridades.split(",") : [];
  return sort(
    s.tickets
      .filter((t) => states.includes(t.estado))
      .filter((t) => !priorities.length || priorities.includes(t.prioridad))
      .filter((t) => !q.categoriaId || t.categoriaId === Number(q.categoriaId))
      .filter((t) => !q.ambienteId || t.ambienteId === Number(q.ambienteId))
      .map((t) => enrich(t, s))
      .filter(
        (t) =>
          !q.busqueda ||
          [t.codigo, t.asunto, t.solicitante].some((s) =>
            s.toLowerCase().includes(q.busqueda.toLowerCase()),
          ),
      ),
    q.orden,
  );
}
export async function assign(key, user, data, auto = false) {
  need(
    auto ? user.rol === "tecnico" : user.rol === "supervisor",
    "Operación no permitida.",
    403,
  );
  await M.db.transaction(async (transaction) => {
    const t = await M.Ticket.findOne({
      where: { codigo: key },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    need(t, "Ticket no encontrado.", 404);
    need(
      activeAssignable.includes(t.estado),
      "Este ticket ya no se puede asignar.",
      409,
    );
    if (auto)
      need(
        !t.tecnicoId && ["abierto", "reabierto"].includes(t.estado),
        "Otro técnico ya tomó este ticket.",
        409,
      );
    const id = auto ? user.id : Number(data.tecnicoId);
    need(t.tecnicoId !== id, "El ticket ya está asignado a ese técnico.", 409);
    const tec = await M.Usuario.findByPk(id, {
      transaction,
      lock: transaction.LOCK.SHARE,
    });
    const link = await M.TecnicoCategoria.findOne({
      where: { tecnicoId: id, categoriaId: t.categoriaId },
      transaction,
      lock: transaction.LOCK.SHARE,
    });
    need(
      tec?.rol === "tecnico" && tec.estado === "activo" && link,
      "Técnico no habilitado para esta categoría.",
      409,
    );
    const tipo = auto
        ? "autoasignacion"
        : t.tecnicoId
          ? "reasignacion"
          : "asignacion",
      motivo =
        tipo === "reasignacion"
          ? text(data.motivo, 1, 240, "motivo")
          : data.motivo
            ? text(data.motivo, 0, 240, "motivo")
            : null,
      nota = data.nota ? text(data.nota, 0, 240, "nota") : null;
    await M.Asignacion.create(
      {
        ticketId: t.id,
        tecnicoId: id,
        asignadoPorId: user.id,
        tipo,
        motivo,
        nota,
        creadoEn: new Date(),
      },
      { transaction },
    );
    await t.update({ tecnicoId: id }, { transaction });
    await note(
      t,
      user,
      "publico",
      `Asignado a ${fullName(tec)}.${nota ? " " + nota : ""}`,
      transaction,
    );
  });
  return detail(key, user);
}
export function codes(data) {
  need(
    Array.isArray(data.codigos) &&
      data.codigos.length > 0 &&
      data.codigos.length <= 100 &&
      data.codigos.every((x) => typeof x === "string"),
    "Selecciona entre 1 y 100 tickets.",
  );
  return [...new Set(data.codigos)].sort();
}
export async function assignBatch(user, data) {
  const result = { asignados: [], omitidos: [] };
  for (const code of codes(data)) {
    try {
      await assign(code, user, {
        ...data,
        motivo: data.motivo || "Reasignación en lote",
      });
      result.asignados.push(code);
    } catch (e) {
      if (!e.status) throw e;
      result.omitidos.push({ codigo: code, motivo: e.message });
    }
  }
  return result;
}
export async function returnQueue(user, data) {
  const list = codes(data),
    motivo = text(data.motivo, 1, 240, "motivo");
  await M.db.transaction(async (transaction) => {
    for (const code of list) {
      const t = await visibleTicket(code, user, {
        transaction,
        lock: true,
        attend: true,
      });
      need(
        activeAssignable.includes(t.estado) && t.tecnicoId,
        "Ticket no asignado o finalizado.",
        409,
      );
      await M.Asignacion.create(
        {
          ticketId: t.id,
          tecnicoId: null,
          asignadoPorId: user.id,
          tipo: "devolucion",
          motivo,
          creadoEn: new Date(),
        },
        { transaction },
      );
      if (t.estado === "en_espera") {
        const e = await M.Espera.findOne({
          where: { ticketId: t.id, finEn: null },
          transaction,
        });
        if (e) {
          const elapsed = Math.max(0, Date.now() - new Date(e.inicioEn));
          await e.update({ finEn: new Date() }, { transaction });
          await t.update(
            {
              venceEn: new Date(+new Date(t.venceEn) + elapsed),
              tiempoEsperaMin: t.tiempoEsperaMin + Math.floor(elapsed / 60000),
            },
            { transaction },
          );
        }
      }
      await transition(t, "abierto", user, motivo, transaction);
      await t.update({ tecnicoId: null }, { transaction });
      await note(
        t,
        user,
        "publico",
        `Devuelto a la cola: ${motivo}`,
        transaction,
      );
    }
  });
  return { devueltos: list };
}
export async function priority(user, data) {
  need(
    user.rol === "supervisor",
    "Solo el supervisor cambia prioridades.",
    403,
  );
  const list = codes(data),
    motivo = text(data.motivo, 1, 240, "motivo");
  need(
    await M.Prioridad.findOne({ where: { codigo: data.nueva } }),
    "Prioridad no válida.",
  );
  await M.db.transaction(async (transaction) => {
    for (const code of list) {
      const t = await visibleTicket(code, user, { transaction, lock: true });
      need(openStates.includes(t.estado), "Ticket finalizado.", 409);
      if (t.prioridad === data.nueva) continue;
      await M.CambioPrioridad.create(
        {
          ticketId: t.id,
          anterior: t.prioridad,
          nueva: data.nueva,
          motivo,
          autorId: user.id,
          creadoEn: new Date(),
        },
        { transaction },
      );
      await t.update({ prioridad: data.nueva }, { transaction });
    }
  });
  return { cambiados: list };
}
export async function inbox(user, q = {}) {
  const s = await snapshot(user),
    all = s.tickets
      .filter((t) => t.tecnicoId === user.id)
      .map((t) => enrich(t, s)),
    live = all.filter(
      (t) =>
        t.estado !== "cancelado" &&
        (t.estado !== "cerrado" ||
          Date.now() - new Date(t.cerradoEn) < 604800000),
    );
  const contadores = {
    total: live.filter((t) => openStates.includes(t.estado)).length,
    abiertos: live.filter((t) => ["abierto", "reabierto"].includes(t.estado))
      .length,
    en_atencion: live.filter((t) => t.estado === "en_atencion").length,
    en_espera: live.filter((t) => t.estado === "en_espera").length,
    resuelto: live.filter((t) => t.estado === "resuelto").length,
    criticos: live.filter(
      (t) => t.prioridad === "critica" && openStates.includes(t.estado),
    ).length,
    vencidos: live.filter((t) => t.vencido).length,
  };
  let list = live.filter((t) => !q.estado || t.estado === q.estado);
  if (q.filtro === "vencidos") list = list.filter((t) => t.vencido);
  if (q.filtro === "criticos")
    list = list.filter(
      (t) => t.prioridad === "critica" && openStates.includes(t.estado),
    );
  if (q.filtro === "hoy")
    list = list.filter(
      (t) =>
        new Date(t.creadoEn).toLocaleDateString("en-CA", {
          timeZone: "America/Lima",
        }) ===
        new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
    );
  return {
    lista: sort(list, q.orden || "plazo").sort(
      (a, b) => Number(a.estado === "cerrado") - Number(b.estado === "cerrado"),
    ),
    contadores,
  };
}
export async function available(user) {
  const s = await snapshot(user);
  return sort(
    s.tickets
      .filter(
        (t) => !t.tecnicoId && ["abierto", "reabierto"].includes(t.estado),
      )
      .map((t) => enrich(t, s)),
    "prioridad",
  );
}
export async function inboxes(user) {
  const s = await snapshot(user);
  return s.usuarios
    .filter((u) => u.rol === "tecnico" && u.estado === "activo")
    .map((u) => {
      const all = s.tickets
          .filter((t) => t.tecnicoId === u.id)
          .map((t) => enrich(t, s)),
        live = all.filter((t) => openStates.includes(t.estado));
      return {
        id: u.id,
        nombre: fullName(u),
        categorias: s.tecnicoCategorias
          .filter((l) => l.tecnicoId === u.id)
          .map((l) => s.categorias.find((c) => c.id === l.categoriaId)?.nombre),
        en_atencion: live.filter((t) => t.estado === "en_atencion").length,
        en_espera: live.filter((t) => t.estado === "en_espera").length,
        abiertos: live.filter((t) =>
          ["abierto", "reabierto"].includes(t.estado),
        ).length,
        vencidos: live.filter((t) => t.vencido).length,
        resueltos: all.filter((t) => t.estado === "resuelto").length,
        tickets: sort(live, "plazo"),
      };
    });
}
