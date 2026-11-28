import { make, D, db, S, T, I, B } from "./base.js";
const Usuario = make("usuarios", {
  nombres: S,
  apellidos: S,
  email: S,
  passwordHash: S,
  telefono: S,
  unidadId: I,
  vinculo: S,
  rol: S,
  estado: S,
  motivoBloqueo: S,
  intentosFallidos: I,
  bloqueadoHasta: T,
  ambienteHabitualId: I,
  creadoEn: T,
  ultimoAcceso: T,
  sessionVersion: I,
});
export default Usuario;
