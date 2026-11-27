// src/services/catalogo.service.js
// HU-2 · Catálogo de servicios. Dueña de categoría, subcategoría, sede, ambiente y técnico_categoría.
import { getTable, apiGet, apiPost, apiPut, apiDelete } from "./api.client";
import { nombreCompleto, listarUsuariosSync } from "./auth.service";

export const ESTADOS_ABIERTOS = [
  "abierto",
  "en_atencion",
  "en_espera",
  "reabierto",
];

export const TIPOS_AMBIENTE = [
  { codigo: "aula", nombre: "Aula" },
  { codigo: "aula_magna", nombre: "Aula magna" },
  { codigo: "laboratorio", nombre: "Laboratorio" },
  { codigo: "auditorio", nombre: "Auditorio" },
  { codigo: "biblioteca", nombre: "Biblioteca" },
  { codigo: "otro", nombre: "Otro" },
];

export function nombreTipoAmbiente(codigo) {
  return TIPOS_AMBIENTE.find((t) => t.codigo === codigo)?.nombre || codigo;
}

// ---------- Lecturas síncronas para otras historias ----------
export function prioridadesSync() {
  return getTable("prioridades");
}

export function horasPorPrioridad(codigo) {
  return prioridadesSync().find((p) => p.codigo === codigo)?.horas ?? 24;
}

export function categoriasSync() {
  return getTable("categorias");
}

export function ambientesSync() {
  return getTable("ambientes");
}

export function sedesSync() {
  return getTable("sedes");
}

function contarAbiertos(tickets, campo, id) {
  return tickets.filter(
    (t) => t[campo] === id && ESTADOS_ABIERTOS.includes(t.estado),
  ).length;
}

// ---------- Categorías ----------
/** Árbol de dos niveles: categoría con sus subcategorías y tickets abiertos */
export async function listarCategorias({
  busqueda = "",
  soloActivas = false,
  prioridad = "",
} = {}) {
  return apiGet("/api/admin/categorias", { busqueda, soloActivas, prioridad });
}

export async function obtenerCategoria(id) {
  return apiGet(`/api/admin/categorias/${id}`);
}

export function validarCategoria(data, categorias = categoriasSync()) {
  const errores = {};
  const nombre = (data.nombre || "").trim();
  if (!nombre) errores.nombre = "El nombre es obligatorio.";
  else if (nombre.length > 60) errores.nombre = "Máximo 60 caracteres.";
  else if (
    categorias.some(
      (c) =>
        c.id !== data.id &&
        (c.parentId ?? null) === (data.parentId ?? null) &&
        c.nombre.toLowerCase() === nombre.toLowerCase(),
    )
  ) {
    errores.nombre =
      "Ya existe una categoría con ese nombre en el mismo nivel.";
  }
  if (!data.prioridadDefecto)
    errores.prioridadDefecto = "Selecciona la prioridad por defecto.";
  const horas = Number(data.tiempoEsperadoHoras);
  if (!Number.isFinite(horas) || horas <= 0)
    errores.tiempoEsperadoHoras = "Debe ser un número mayor que cero.";
  if ((data.descripcion || "").length > 240)
    errores.descripcion = "Máximo 240 caracteres.";
  if (
    data.parentId &&
    data.id &&
    categorias.some((c) => c.parentId === data.id)
  ) {
    errores.parentId =
      "Esta categoría tiene subcategorías; no puede pasar a ser subcategoría.";
  }
  return errores;
}

export async function guardarCategoria(data) {
  return data.id
    ? apiPut(`/api/admin/categorias/${data.id}`, data)
    : apiPost("/api/admin/categorias", { ...data, confirmar: true });
}

/** Tickets en curso de una categoría (o subcategoría) y sus hijas */
export function ticketsEnCursoDeCategoria(id) {
  const categorias = categoriasSync();
  const ids = [
    id,
    ...categorias.filter((c) => c.parentId === id).map((c) => c.id),
  ];
  return getTable("tickets").filter(
    (t) =>
      (ids.includes(t.categoriaId) || ids.includes(t.subcategoriaId)) &&
      ESTADOS_ABIERTOS.includes(t.estado),
  ).length;
}

export async function cambiarEstadoCategoria(id, activa) {
  return apiPut(`/api/admin/categorias/${id}/estado`, {
    activa,
    confirmar: true,
  });
}

export async function eliminarCategoria(id) {
  return apiDelete(`/api/admin/categorias/${id}`);
}

// ---------- Sedes y ambientes ----------
export async function listarSedes() {
  return apiGet("/api/admin/sedes");
}

export async function listarAmbientes({
  busqueda = "",
  sedeId = "",
  pabellon = "",
  tipo = "",
} = {}) {
  return apiGet("/api/admin/ambientes", { busqueda, sedeId, pabellon, tipo });
}

export function validarAmbiente(data, ambientes = ambientesSync()) {
  const errores = {};
  const codigo = (data.codigo || "").trim().toUpperCase();
  if (!codigo) errores.codigo = "El código es obligatorio.";
  else if (!/^[A-Z0-9-]{2,15}$/.test(codigo))
    errores.codigo = "Usa letras, números y guiones (máx. 15).";
  else if (ambientes.some((a) => a.id !== data.id && a.codigo === codigo))
    errores.codigo = "Ya existe un ambiente con ese código.";
  if (!(data.nombre || "").trim()) errores.nombre = "El nombre es obligatorio.";
  if (!data.tipo) errores.tipo = "Selecciona el tipo.";
  if (!data.sedeId) errores.sedeId = "Selecciona la sede.";
  if (!(data.pabellon || "").trim()) errores.pabellon = "Indica el pabellón.";
  if (data.piso === "" || !Number.isInteger(Number(data.piso)))
    errores.piso = "Indica el piso.";
  if (!(Number(data.capacidad) > 0))
    errores.capacidad = "Debe ser mayor que cero.";
  return errores;
}

export async function guardarAmbiente(data) {
  return data.id
    ? apiPut(`/api/admin/ambientes/${data.id}`, data)
    : apiPost("/api/admin/ambientes", data);
}

export async function eliminarAmbiente(id) {
  return apiDelete(`/api/admin/ambientes/${id}`);
}

// ---------- Técnicos por categoría ----------
export async function obtenerMatrizTecnicos() {
  return apiGet("/api/admin/tecnico-categorias");
}

/** asignaciones = { [tecnicoId]: [categoriaId, ...] } */
export async function guardarMatrizTecnicos(asignaciones) {
  return apiPut("/api/admin/tecnico-categorias", asignaciones);
}

/** Lectura usada por HU-4: técnicos habilitados para una categoría */
export function tecnicosHabilitadosSync(categoriaId) {
  const ids = getTable("tecnicoCategorias")
    .filter((r) => r.categoriaId === categoriaId)
    .map((r) => r.tecnicoId);
  return listarUsuariosSync({ rol: "tecnico" }).filter(
    (t) => t.estado === "activo" && ids.includes(t.id),
  );
}

export function categoriasDeTecnicoSync(tecnicoId) {
  return getTable("tecnicoCategorias")
    .filter((r) => r.tecnicoId === tecnicoId)
    .map((r) => r.categoriaId);
}

/** Resumen del ambiente que se muestra en el detalle del ticket */
export function resumenAmbienteSync(ambienteId) {
  const tickets = getTable("tickets").filter(
    (t) => t.ambienteId === ambienteId,
  );
  const ultimoCierre = tickets
    .filter((t) => t.cerradoEn)
    .sort((a, b) => new Date(b.cerradoEn) - new Date(a.cerradoEn))[0];
  return {
    abiertos: tickets.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length,
    ultimoCierre: ultimoCierre?.cerradoEn || null,
  };
}
