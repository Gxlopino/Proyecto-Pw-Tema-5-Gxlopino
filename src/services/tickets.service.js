// src/services/tickets.service.js
// HU-3 · Registro y seguimiento de tickets. Dueña de la entidad ticket (registro, cancelación y reapertura).
import { getTable, apiGet, apiPost } from "./api.client";
import { nombreCompleto, sinPassword } from "./auth.service";
import {
  ESTADOS_ABIERTOS,
  horasPorPrioridad,
  nombreTipoAmbiente,
} from "./catalogo.service";

export const PLAZO_REAPERTURA_DIAS = 7;
export const MAX_DESCRIPCION = 600;

export function estadosSync() {
  return getTable("estadosTicket");
}

/** Agrega los nombres que las vistas necesitan (categoría, ambiente, personas) */
export function enriquecerTicket(t, ctx = null) {
  const c = ctx || {
    categorias: getTable("categorias"),
    ambientes: getTable("ambientes"),
    sedes: getTable("sedes"),
    usuarios: getTable("usuarios"),
  };
  const categoria = c.categorias.find((x) => x.id === t.categoriaId);
  const subcategoria = c.categorias.find((x) => x.id === t.subcategoriaId);
  const ambiente = c.ambientes.find((x) => x.id === t.ambienteId);
  const solicitante = c.usuarios.find((x) => x.id === t.solicitanteId);
  const tecnico = c.usuarios.find((x) => x.id === t.tecnicoId);
  const sede = ambiente && c.sedes.find((s) => s.id === ambiente.sedeId);
  return {
    ...t,
    categoria: categoria?.nombre || "—",
    subcategoria: subcategoria?.nombre || "—",
    ambiente: ambiente?.codigo || "—",
    ambienteDetalle: ambiente
      ? `${nombreTipoAmbiente(ambiente.tipo)} · Pabellón ${ambiente.pabellon} · piso ${ambiente.piso} · capacidad ${ambiente.capacidad} · ${sede?.nombre || ""}`
      : "",
    solicitante: nombreCompleto(solicitante),
    solicitanteTelefono: solicitante?.telefono || "—",
    tecnico: tecnico ? nombreCompleto(tecnico) : null,
    vencido:
      ESTADOS_ABIERTOS.includes(t.estado) &&
      t.estado !== "en_espera" &&
      new Date(t.venceEn) < new Date(),
  };
}

export function contextoTickets() {
  return {
    categorias: getTable("categorias"),
    ambientes: getTable("ambientes"),
    sedes: getTable("sedes"),
    usuarios: getTable("usuarios").map(sinPassword),
  };
}

// ---------- Registro ----------
/** Ticket abierto para el mismo ambiente y la misma categoría */
export async function buscarDuplicado(ambienteId, categoriaId) {
  if (!ambienteId || !categoriaId) return null;
  return apiGet("/api/website/tickets/duplicado", { ambienteId, categoriaId });
}

export function validarTicket(data) {
  const errores = {};
  const categorias = getTable("categorias");
  const categoria = categorias.find((c) => c.id === Number(data.categoriaId));
  const sub = categorias.find((c) => c.id === Number(data.subcategoriaId));
  if (!categoria) errores.categoriaId = "Selecciona la categoría.";
  else if (!categoria.activa)
    errores.categoriaId =
      "La categoría está inactiva y no admite tickets nuevos.";
  if (!sub) errores.subcategoriaId = "Selecciona la subcategoría.";
  else if (sub.parentId !== Number(data.categoriaId))
    errores.subcategoriaId =
      "La subcategoría no pertenece a la categoría elegida.";
  else if (!sub.activa)
    errores.subcategoriaId = "La subcategoría está inactiva.";
  if (!getTable("ambientes").some((a) => a.id === Number(data.ambienteId)))
    errores.ambienteId = "Selecciona el ambiente afectado.";
  const asunto = (data.asunto || "").trim();
  if (asunto.length < 5)
    errores.asunto = "Escribe un asunto de al menos 5 caracteres.";
  else if (asunto.length > 100) errores.asunto = "Máximo 100 caracteres.";
  const desc = (data.descripcion || "").trim();
  if (desc.length < 20)
    errores.descripcion = "Describe la falla con al menos 20 caracteres.";
  else if (desc.length > MAX_DESCRIPCION)
    errores.descripcion = `Máximo ${MAX_DESCRIPCION} caracteres.`;
  if (!data.prioridadSugerida)
    errores.prioridadSugerida = "Selecciona la prioridad sugerida.";
  return errores;
}

export async function crearTicket(data, usuarioId) {
  return apiPost("/api/website/tickets", data);
}

// ---------- Seguimiento ----------
export async function listarMisTickets(
  usuarioId,
  { estado = "", desde = "", hasta = "", codigo = "", categoriaId = "" } = {},
) {
  return apiGet("/api/website/tickets", {
    estado,
    desde,
    hasta,
    codigo,
    categoriaId,
  });
}

export function resumenUsuarioSync(usuarioId) {
  const mios = getTable("tickets").filter((t) => t.solicitanteId === usuarioId);
  return {
    total: mios.length,
    abiertos: mios.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length,
  };
}

/** Obtiene un ticket por código validando quién lo puede ver */
export async function obtenerTicket(codigo, usuario) {
  return apiGet(`/api/website/tickets/${codigo}`);
}

export function puedeReabrir(t) {
  if (t.estado !== "cerrado" || !t.cerradoEn) return false;
  return (
    Date.now() - new Date(t.cerradoEn).getTime() <=
    PLAZO_REAPERTURA_DIAS * 86400000
  );
}

export function puedeCancelar(t) {
  return t.estado === "abierto" && !t.tecnicoId;
}

export async function agregarInformacion(codigo, usuario, texto) {
  return apiPost(`/api/website/tickets/${codigo}/informacion`, { texto });
}

export async function cancelarTicket(codigo, usuario, motivo = "") {
  return apiPost(`/api/website/tickets/${codigo}/cancelar`, { motivo });
}

export async function reabrirTicket(codigo, usuario, motivo) {
  return apiPost(`/api/website/tickets/${codigo}/reabrir`, { motivo });
}
