// Vista inicial de cada rol de Mesa de ayuda.
export function rutaInicio(rol) {
  if (rol === "tecnico") return "/tecnico/bandeja";
  if (rol === "supervisor") return "/supervisor/cola";
  return "/usuario/tickets";
}
