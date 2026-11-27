// scripts/seed.js
import fs from "node:fs/promises";
import bcrypt from "bcryptjs";
import * as M from "../website/models/index.js";
const data = JSON.parse(
  await fs.readFile(new URL("../db/seed/seed.json", import.meta.url), "utf8"),
);
const offset = Date.now() - new Date(data.fechaReferencia);
const shift = (v) => (v ? new Date(+new Date(v) + offset) : null);
const seedHash = await bcrypt.hash("SoloPruebas2026!", 12);
try {
  await M.db.transaction(async (transaction) => {
    if (await M.Usuario.count({ transaction })) {
      console.log(
        "La base ya contiene usuarios. Semillas omitidas para conservar cambios.",
      );
      return;
    }
    const insert = async (model, rows) => {
      for (const row of rows) await model.create(row, { transaction });
    };
    await insert(M.Prioridad, data.prioridades);
    await insert(M.Estado, data.estadosTicket);
    await insert(
      M.Unidad,
      data.unidades.map((nombre, i) => ({ id: i + 1, nombre })),
    );
    await insert(M.Sede, data.sedes);
    await insert(M.Ambiente, data.ambientes);
    await insert(
      M.Categoria,
      data.categorias.map((c) => ({ ...c, creadaEn: new Date() })),
    );
    await insert(
      M.Usuario,
      data.usuarios.map((u) => ({
        ...u,
        unidadId: data.unidades.indexOf(u.unidad) + 1,
        passwordHash: seedHash,
        intentosFallidos: 0,
        sessionVersion: 1,
        creadoEn: shift(u.creadoEn),
        ultimoAcceso: shift(u.ultimoAcceso),
      })),
    );
    await insert(
      M.TecnicoCategoria,
      data.tecnicoCategorias.map((c) => ({ ...c, habilitadoEn: new Date() })),
    );
    await insert(
      M.Especialidad,
      data.usuarios.flatMap((u) =>
        u.especialidades.map((categoriaId) => ({
          usuarioId: u.id,
          categoriaId,
        })),
      ),
    );
    await insert(
      M.Ticket,
      data.tickets.map((t) => ({
        ...t,
        creadoEn: shift(t.creadoEn),
        venceEn: shift(t.venceEn),
        tiempoEsperaMin: 0,
      })),
    );
    await insert(
      M.Cierre,
      data.tickets
        .filter((t) => t.resueltoEn)
        .map((t) => ({
          ticketId: t.id,
          solucion: t.solucion,
          resueltoEn: shift(t.resueltoEn),
          cerradoEn: shift(t.cerradoEn),
          tiempoAtencionMin: t.cerradoEn
            ? Math.max(
                0,
                Math.floor(
                  (new Date(t.cerradoEn) - new Date(t.creadoEn)) / 60000,
                ),
              )
            : null,
        })),
    );
    await insert(
      M.Espera,
      data.tickets
        .filter((t) => t.estado === "en_espera")
        .map((t) => ({
          ticketId: t.id,
          motivo: t.motivoEspera || "Espera de repuesto",
          fechaRetorno: shift(t.fechaRetorno || t.venceEn),
          inicioEn: shift(
            data.historialEstados
              .filter(
                (h) => h.ticketId === t.id && h.estadoNuevo === "en_espera",
              )
              .at(-1)?.creadoEn || t.creadoEn,
          ),
        })),
    );
    await insert(
      M.Reapertura,
      data.tickets
        .filter((t) => t.motivoReapertura)
        .map((t) => ({
          ticketId: t.id,
          autorId: t.solicitanteId,
          motivo: t.motivoReapertura,
          creadoEn: shift(t.creadoEn),
        })),
    );
    for (const [model, key] of [
      [M.Asignacion, "asignaciones"],
      [M.CambioPrioridad, "cambiosPrioridad"],
      [M.Bitacora, "bitacora"],
      [M.Historial, "historialEstados"],
    ])
      await insert(
        model,
        data[key].map((x) => ({
          ...x,
          creadoEn: shift(x.creadoEn),
          ...(key === "historialEstados" ? { permanenciaMin: 0 } : {}),
        })),
      );
    for (const model of [
      M.Prioridad,
      M.Estado,
      M.Unidad,
      M.Sede,
      M.Ambiente,
      M.Categoria,
      M.Usuario,
      M.TecnicoCategoria,
      M.Especialidad,
      M.Ticket,
      M.Cierre,
      M.Espera,
      M.Reapertura,
      M.Bitacora,
      M.Historial,
      M.Asignacion,
      M.CambioPrioridad,
    ]) {
      const table = model.getTableName();
      await M.db.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT max(id) FROM "${table}"),0)+1,false)`,
        { transaction },
      );
    }
    console.log(
      "Semillas ficticias cargadas: 16 usuarios y 23 tickets. Contraseña de demostración: SoloPruebas2026!",
    );
  });
} catch (e) {
  console.error("No se cargaron semillas:", e.name, e.original?.code || "");
  process.exitCode = 1;
} finally {
  await M.db.close();
}
