// src/services/api.client.js
import axios from "axios";
export const DATA_EVENT = "mesa-ayuda:datos";
const http = axios.create({ withCredentials: true });
let db = {},
  pending = null;
export class ApiError extends Error {
  constructor(message, status = 400, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}
async function request(p) {
  try {
    const { data } = await p;
    return data.data;
  } catch (ex) {
    const b = ex.response?.data || {};
    const err = new ApiError(
      b.message || "No se pudo conectar con el servidor.",
      ex.response?.status || 500,
    );
    if (b.error && typeof b.error === "object") err.errores = b.error;
    throw err;
  }
}
export async function refreshSnapshot() {
  if (!pending)
    pending = request(http.get("/api/bootstrap"))
      .then((data) => {
        db = data;
        window.dispatchEvent(new CustomEvent(DATA_EVENT));
        return data;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
export function getTable(name) {
  return structuredClone(db[name] || []);
}
export async function apiGet(url, params) {
  const result = await request(http.get(url, { params }));
  if (url !== "/api/bootstrap") await refreshSnapshot();
  return result;
}
async function mutation(method, url, body) {
  const result = await request(http[method](url, body));
  await refreshSnapshot();
  return result;
}
export const apiPost = (url, body) => mutation("post", url, body);
export const apiPut = (url, body) => mutation("put", url, body);
export const apiDelete = (url) => mutation("delete", url);

// Cargar la instantánea antes de ejecutar las entradas originales del frontend.
if (typeof window !== "undefined") {
  try { await refreshSnapshot(); }
  catch (error) {
    const root = document.getElementById("root");
    if (root) { root.textContent = error.message; root.setAttribute("role", "alert"); }
    throw error;
  }
}
