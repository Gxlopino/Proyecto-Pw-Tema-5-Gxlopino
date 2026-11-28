// admin/services/common.js
export class ServiceError extends Error {
  constructor(message, status = 400, errores = null) {
    super(message);
    this.status = status;
    this.errores = errores;
  }
}
export function requireValue(ok, message, status = 400, field) {
  if (!ok)
    throw new ServiceError(
      message,
      status,
      field ? { [field]: message } : null,
    );
}
export function text(value, min, max, field) {
  requireValue(
    typeof value === "string" &&
      value.trim().length >= min &&
      value.trim().length <= max,
    `Revisa ${field}: entre ${min} y ${max} caracteres.`,
    400,
    field,
  );
  return value.trim();
}
export const openStates = [
  "abierto",
  "reabierto",
  "en_atencion",
  "en_espera",
  "resuelto",
];
export const fullName = (u) =>
  u ? `${u.nombres.split(" ")[0]} ${u.apellidos}` : "—";
export const plain = (x) => (x?.get ? x.get({ plain: true }) : x);
