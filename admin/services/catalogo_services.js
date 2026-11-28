// admin/services/catalogo_services.js
import { Op, fn, col, where } from "sequelize";
import * as M from "../models/index.js";
import { snapshot, enrich } from "../repositories/mesa_repositories.js";
import { requireValue as need, text, openStates, fullName } from "./common.js";
export async function categories(user, q = {}) {
  const s = await snapshot(user),
    count = (id, key) =>
      s.tickets.filter((t) => t[key] === id && openStates.includes(t.estado))
        .length;
  return s.categorias
    .filter((c) => !c.parentId)
    .map((c) => ({
      ...c,
      ticketsAbiertos: count(c.id, "categoriaId"),
      subcategorias: s.categorias
        .filter((x) => x.parentId === c.id)
        .map((x) => ({ ...x, ticketsAbiertos: count(x.id, "subcategoriaId") })),
    }))
    .filter((c) => q.soloActivas !== "true" || c.activa)
    .filter((c) => !q.prioridad || c.prioridadDefecto === q.prioridad)
    .filter(
      (c) =>
        !q.busqueda ||
        [c.nombre, ...c.subcategorias.map((s) => s.nombre)].some((n) =>
          n.toLowerCase().includes(q.busqueda.toLowerCase()),
        ),
    );
}
export async function saveCategory(id, d) {
  return M.db.transaction(async (transaction) => {
    const c = id
      ? await M.Categoria.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : null;
    need(!id || c, "Categoría no encontrada.", 404);
    const nombre = text(d.nombre, 1, 60, "nombre"),
      parentId = d.parentId ? Number(d.parentId) : null;
    if (parentId) {
      const p = await M.Categoria.findByPk(parentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      need(
        p && !p.parentId && p.id !== Number(id),
        "Solo se admiten dos niveles de categorías.",
      );
      need(
        !id ||
          !(await M.Categoria.count({ where: { parentId: id }, transaction })),
        "Una categoría con hijas no puede ser subcategoría.",
        409,
      );
    }
    need(
      await M.Prioridad.findOne({
        where: { codigo: d.prioridadDefecto },
        transaction,
      }),
      "Prioridad no válida.",
    );
    need(
      Number.isInteger(Number(d.tiempoEsperadoHoras)) &&
        Number(d.tiempoEsperadoHoras) > 0,
      "Tiempo esperado mayor que cero.",
      400,
      "tiempoEsperadoHoras",
    );
    need(typeof d.activa === "boolean", "Estado no válido.");
    if (c && c.parentId !== parentId)
      need(
        !(await M.Ticket.count({
          where: { [Op.or]: [{ categoriaId: id }, { subcategoriaId: id }] },
          transaction,
        })),
        "No se puede cambiar de nivel una categoría utilizada.",
        409,
      );
    if (c?.activa && !d.activa) await confirmInactive(id, d, transaction);
    const values = {
      nombre,
      parentId,
      prioridadDefecto: d.prioridadDefecto,
      tiempoEsperadoHoras: Number(d.tiempoEsperadoHoras),
      descripcion: d.descripcion
        ? text(d.descripcion, 0, 240, "descripcion")
        : "",
      activa: d.activa,
      creadaEn: c?.creadaEn || new Date(),
    };
    return c
      ? c.update(values, { transaction })
      : M.Categoria.create(values, { transaction });
  });
}
async function confirmInactive(id, d, transaction) {
  const children = await M.Categoria.findAll({
    where: { parentId: id },
    transaction,
    raw: true,
  });
  const count = await M.Ticket.count({
    where: {
      estado: { [Op.in]: openStates },
      [Op.or]: [{ categoriaId: id }, { subcategoriaId: id }],
    },
    transaction,
  });
  need(
    !count || d.confirmar === true,
    "Confirma la desactivación: existen tickets en curso.",
    409,
    "confirmar",
  );
  return children;
}
export async function categoryStatus(id, d) {
  return M.db.transaction(async (transaction) => {
    const c = await M.Categoria.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    need(c, "Categoría no encontrada.", 404);
    need(typeof d.activa === "boolean", "Estado no válido.");
    if (!d.activa) await confirmInactive(id, d, transaction);
    await c.update({ activa: d.activa }, { transaction });
    return c;
  });
}
export async function deleteCategory(id) {
  return M.db.transaction(async (transaction) => {
    const c = await M.Categoria.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    need(c, "Categoría no encontrada.", 404);
    need(
      !(await M.Categoria.count({ where: { parentId: id }, transaction })),
      "Primero elimina las subcategorías.",
      409,
    );
    need(
      !(await M.Ticket.count({
        where: { [Op.or]: [{ categoriaId: id }, { subcategoriaId: id }] },
        transaction,
      })),
      "Categoría con tickets registrados.",
      409,
    );
    await c.destroy({ transaction });
    return true;
  });
}
export async function saveEnvironment(id, d) {
  const v = {
    codigo: text(d.codigo, 1, 15, "codigo").toUpperCase(),
    nombre: text(d.nombre, 1, 60, "nombre"),
    tipo: d.tipo,
    pabellon: text(d.pabellon, 1, 30, "pabellon"),
    piso: Number(d.piso),
    capacidad: Number(d.capacidad),
    sedeId: Number(d.sedeId),
    activo: d.activo !== false,
  };
  need(
    [
      "aula",
      "aula_magna",
      "laboratorio",
      "auditorio",
      "biblioteca",
      "otro",
    ].includes(v.tipo),
    "Tipo no válido.",
  );
  need(Number.isInteger(v.piso) && v.piso >= 0, "Piso no válido.");
  need(
    Number.isInteger(v.capacidad) && v.capacidad > 0,
    "Capacidad mayor que cero.",
  );
  need(await M.Sede.findByPk(v.sedeId), "Sede no válida.");
  if (!id) return M.Ambiente.create(v);
  const a = await M.Ambiente.findByPk(id);
  need(a, "Ambiente no encontrado.", 404);
  return a.update(v);
}
export async function deleteEnvironment(id) {
  const a = await M.Ambiente.findByPk(id);
  need(a, "Ambiente no encontrado.", 404);
  need(
    !(await M.Ticket.count({ where: { ambienteId: id } })),
    "Ambiente con tickets registrados.",
    409,
  );
  await a.destroy();
  return true;
}
export async function saveSite(id, d) {
  const v = {
    nombre: text(d.nombre, 1, 60, "nombre"),
    direccion: text(d.direccion, 0, 120, "direccion"),
    activa: d.activa !== false,
  };
  if (!id) return M.Sede.create(v);
  const s = await M.Sede.findByPk(id);
  need(s, "Sede no encontrada.", 404);
  return s.update(v);
}
export async function deleteSite(id) {
  const s = await M.Sede.findByPk(id);
  need(s, "Sede no encontrada.", 404);
  need(
    !(await M.Ambiente.count({ where: { sedeId: id } })),
    "Sede con ambientes registrados.",
    409,
  );
  await s.destroy();
  return true;
}
export async function matrix(user) {
  const s = await snapshot(user);
  return {
    categorias: s.categorias.filter((c) => !c.parentId),
    filas: s.usuarios
      .filter((u) => u.rol === "tecnico" && u.estado === "activo")
      .map((u) => ({
        id: u.id,
        nombre: fullName(u),
        especialidadDeclarada: u.especialidades
          .map((id) => s.categorias.find((c) => c.id === id)?.nombre)
          .filter(Boolean),
        carga: s.tickets.filter(
          (t) => t.tecnicoId === u.id && openStates.includes(t.estado),
        ).length,
        categorias: s.tecnicoCategorias
          .filter((l) => l.tecnicoId === u.id)
          .map((l) => l.categoriaId),
      })),
  };
}
export async function saveMatrix(data) {
  need(
    data && typeof data === "object" && !Array.isArray(data),
    "Matriz no válida.",
  );
  return M.db.transaction(async (transaction) => {
    const users = await M.Usuario.findAll({
      where: { rol: "tecnico", estado: "activo" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const cats = await M.Categoria.findAll({
      where: { parentId: null },
      transaction,
    });
    const links = [];
    for (const [id, ids] of Object.entries(data)) {
      need(
        users.some((u) => u.id === Number(id)) && Array.isArray(ids),
        "Técnico no válido.",
      );
      for (const cat of new Set(ids.map(Number))) {
        need(
          cats.some((c) => c.id === cat),
          "Categoría no válida.",
        );
        links.push({
          tecnicoId: Number(id),
          categoriaId: cat,
          habilitadoEn: new Date(),
        });
      }
    }
    await M.TecnicoCategoria.destroy({ where: {}, transaction });
    await M.TecnicoCategoria.bulkCreate(links, { transaction });
    return true;
  });
}
