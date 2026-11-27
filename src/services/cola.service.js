// src/services/cola.service.js
// HU-4 · Cola y asignación. Dueña de asignación y cambio_prioridad.
import { getTable, apiGet, apiPost } from "./api.client";
import { nombreCompleto } from "./auth.service";
import {
  ESTADOS_ABIERTOS,
  horasPorPrioridad,
  tecnicosHabilitadosSync,
  categoriasDeTecnicoSync,
} from "./catalogo.service";
import { enriquecerTicket } from "./tickets.service";

export const ESTADOS_COLA = [
  "abierto",
  "reabierto",
  "en_atencion",
  "en_espera",
  "resuelto",
];

function esHoy(fecha) {
  if (!fecha) return false;
  const d = new Date(fecha);
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString();
}

// ---------- Cola general (supervisor) ----------
export async function listarCola({
  busqueda = "",
  prioridades = [],
  estados = [],
  categoriaId = "",
  ambienteId = "",
  orden = "antiguedad",
} = {}) {
  return apiGet("/api/admin/cola", {
    busqueda,
    prioridades: prioridades.join(","),
    estados: estados.join(","),
    categoriaId,
    ambienteId,
    orden,
  });
}

export function resumenColaSync() {
  const tickets = getTable("tickets").map((t) => enriquecerTicket(t));
  const enCola = tickets.filter((t) => ESTADOS_COLA.includes(t.estado));
  return {
    total: enCola.length,
    abiertos: tickets.filter((t) => ["abierto", "reabierto"].includes(t.estado))
      .length,
    enAtencion: tickets.filter((t) => t.estado === "en_atencion").length,
    enEspera: tickets.filter((t) => t.estado === "en_espera").length,
    resueltosHoy: tickets.filter(
      (t) => ["resuelto", "cerrado"].includes(t.estado) && esHoy(t.resueltoEn),
    ).length,
    sinAsignar: enCola.filter((t) => !t.tecnicoId).length,
    fueraDeTiempo: enCola.filter((t) => t.vencido).length,
  };
}

/** Técnicos habilitados para la categoría del ticket, con su carga actual */
export function tecnicosParaCategoria(categoriaId) {
  const tickets = getTable("tickets");
  return tecnicosHabilitadosSync(categoriaId)
    .map((tec) => {
      const activos = tickets.filter(
        (t) => t.tecnicoId === tec.id && ESTADOS_ABIERTOS.includes(t.estado),
      );
      return {
        id: tec.id,
        nombre: nombreCompleto(tec),
        carga: activos.length,
        criticos: activos.filter((t) => t.prioridad === "critica").length,
      };
    })
    .sort((a, b) => a.carga - b.carga);
}

/** Todos los técnicos activos con su carga (para la asignación en lote) */
export function cargaTecnicosSync() {
  const tickets = getTable("tickets");
  return getTable("usuarios")
    .filter((u) => u.rol === "tecnico" && u.estado === "activo")
    .map((tec) => {
      const activos = tickets.filter(
        (t) => t.tecnicoId === tec.id && ESTADOS_ABIERTOS.includes(t.estado),
      );
      return {
        id: tec.id,
        nombre: nombreCompleto(tec),
        carga: activos.length,
        criticos: activos.filter((t) => t.prioridad === "critica").length,
      };
    })
    .sort((a, b) => a.carga - b.carga);
}

/** Asigna o reasigna un ticket. La reasignación exige motivo. */
export async function asignar(
  codigo,
  tecnicoId,
  usuario,
  { nota = "", motivo = "" } = {},
) {
  return apiPost(`/api/admin/cola/${codigo}/asignar`, {
    tecnicoId,
    nota,
    motivo,
  });
}

/** Asignación en lote: solo a tickets de categorías que el técnico atiende */
export async function asignarLote(codigos, tecnicoId, usuario, nota = "") {
  return apiPost("/api/admin/cola/lote/asignar", { codigos, tecnicoId, nota });
}

export async function devolverACola(
  codigos,
  usuario,
  motivo = "Devuelto a la cola",
) {
  return apiPost("/api/admin/cola/devolver", { codigos, motivo });
}

export async function cambiarPrioridad(codigos, nueva, motivo, usuario) {
  return apiPost("/api/admin/cola/prioridad", { codigos, nueva, motivo });
}

// ---------- Bandeja del técnico ----------
export async function bandejaTecnico(
  tecnicoId,
  { estado = "", filtro = "todos", orden = "plazo" } = {},
) {
  return apiGet("/api/admin/bandeja", { estado, filtro, orden });
}

/** Tickets sin asignar de las categorías del técnico (para autoasignarse) */
export async function disponiblesParaTecnico(tecnicoId) {
  return apiGet("/api/admin/bandeja/disponibles");
}

export async function autoasignar(codigo, tecnico) {
  return apiPost(`/api/admin/bandeja/${codigo}/tomar`);
}

// ---------- Bandejas de técnicos (supervisor) ----------
export async function bandejasTecnicos() {
  return apiGet("/api/admin/bandejas");
}

/** Contador que se muestra en la cabecera según el rol */
export function contadoresCabeceraSync(usuario) {
  if (!usuario) return {};
  const tickets = getTable("tickets");
  if (usuario.rol === "usuario") {
    const mios = tickets.filter((t) => t.solicitanteId === usuario.id);
    return {
      misTickets: mios.length,
      abiertos: mios.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length,
    };
  }
  if (usuario.rol === "tecnico") {
    const mios = tickets.filter((t) => t.tecnicoId === usuario.id);
    const vivos = mios.filter(
      (t) => ESTADOS_ABIERTOS.includes(t.estado) || t.estado === "resuelto",
    );
    return {
      asignados: vivos.length,
      en_atencion: mios.filter((t) => t.estado === "en_atencion").length,
      en_espera: mios.filter((t) => t.estado === "en_espera").length,
      resuelto: mios.filter((t) => t.estado === "resuelto").length,
    };
  }
  const enCola = tickets.filter((t) => ESTADOS_COLA.includes(t.estado));
  return {
    cola: enCola.length,
    sinAsignar: enCola.filter((t) => !t.tecnicoId && t.estado !== "resuelto")
      .length,
    tecnicos: getTable("usuarios").filter(
      (u) => u.rol === "tecnico" && u.estado === "activo",
    ).length,
    categorias: getTable("categorias").filter(
      (c) => c.parentId === null && c.activa,
    ).length,
    ambientes: getTable("ambientes").length,
  };
}
