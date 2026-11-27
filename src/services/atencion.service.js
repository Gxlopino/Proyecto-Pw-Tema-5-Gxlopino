// src/services/atencion.service.js
// HU-5 · Atención y cierre. Dueña de bitácora_entrada e historial_estado.
// La API valida las transiciones y registra todos los eventos en PostgreSQL.
import { getTable, apiGet, apiPost } from "./api.client";
import { nombreCompleto, iniciales } from "./auth.service";
import { enriquecerTicket } from "./tickets.service";
import { formatDuracion } from "../helpers/datetime";

export const TRANSICIONES = {
  abierto: ["en_atencion"],
  reabierto: ["en_atencion"],
  en_atencion: ["en_espera", "resuelto"],
  en_espera: ["en_atencion"],
  resuelto: ["en_atencion"],
};

export const DESCRIPCION_ESTADO = {
  en_atencion: "el técnico está trabajando en la falla",
  en_espera: "falta un repuesto o depende de un tercero",
  resuelto: "la falla ya no se presenta",
  abierto: "pendiente de atención",
};

const ESTADOS_UI = ["en_atencion", "en_espera", "resuelto", "abierto"];
const MIN_SOLUCION = 15;

// ---------- Escritura interna ----------

// ---------- Permisos ----------
export function puedeAtender(ticket, usuario) {
  if (!usuario) return false;
  if (usuario.rol === "supervisor") return true;
  return usuario.rol === "tecnico" && ticket.tecnicoId === usuario.id;
}

// ---------- Bitácora ----------
export async function listarBitacora(
  ticketId,
  { incluirInternas = false } = {},
) {
  return apiGet(`/api/admin/tickets/${ticketId}/bitacora`, { incluirInternas });
}

export async function agregarEntrada(codigo, usuario, tipo, texto) {
  return apiPost(`/api/admin/tickets/${codigo}/bitacora`, { tipo, texto });
}

// ---------- Estados ----------
/** Opciones del modal 5.3: permitidas y no permitidas desde el estado actual */
export function opcionesDeEstado(estadoActual) {
  const permitidas = TRANSICIONES[estadoActual] || [];
  return ESTADOS_UI.filter((e) => e !== estadoActual).map((e) => ({
    estado: e,
    permitida: permitidas.includes(e),
  }));
}

export async function cambiarEstado(
  codigo,
  usuario,
  nuevo,
  { motivoEspera = "", fechaRetorno = "" } = {},
) {
  return apiPost(`/api/admin/tickets/${codigo}/estado`, {
    estado: nuevo,
    motivoEspera,
    fechaRetorno,
  });
}

export function puedeCerrar(t) {
  return ["en_atencion", "resuelto"].includes(t.estado);
}

/** Tiempo de atención: total menos el tiempo en espera */
export function calcularTiempos(
  ticket,
  historial = getTable("historialEstados"),
) {
  const filas = historial
    .filter((h) => h.ticketId === ticket.id)
    .sort((a, b) => new Date(a.creadoEn) - new Date(b.creadoEn));
  const fin = ticket.cerradoEn
    ? new Date(ticket.cerradoEn).getTime()
    : Date.now();
  let espera = 0;
  filas.forEach((h, i) => {
    if (h.estadoNuevo === "en_espera") {
      const hasta = filas[i + 1]
        ? new Date(filas[i + 1].creadoEn).getTime()
        : fin;
      espera += hasta - new Date(h.creadoEn).getTime();
    }
  });
  const total = fin - new Date(ticket.creadoEn).getTime();
  return { total, espera, atencion: total - espera };
}

export async function cerrarTicket(codigo, usuario, solucion) {
  return apiPost(`/api/admin/tickets/${codigo}/cerrar`, { solucion });
}

// ---------- Historial ----------
/** Línea de tiempo completa: estados, asignaciones y cambios de prioridad */
export async function obtenerHistorial(codigo, usuario) {
  return apiGet(`/api/admin/tickets/${codigo}/historial`);
}
