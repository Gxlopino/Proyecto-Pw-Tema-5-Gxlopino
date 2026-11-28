import * as A from "../../admin/services/cuenta_services.js";
import { snapshot } from "../../admin/repositories/mesa_repositories.js";
import { saveSession, destroySession } from "../../admin/controllers/sesion_controllers.js";
export async function home(req, res) {
  const s = await snapshot();
  res.render("visitante/home", {
    currentPage: "home",
    categorias: s.categorias
      .filter((c) => !c.parentId && c.activa)
      .map((c) => ({
        ...c,
        subcategorias: s.categorias.filter(
          (x) => x.parentId === c.id && x.activa,
        ),
      })),
    prioridades: s.prioridades,
  });
}
export function login(req, res) {
  return req.user ? res.redirect(res.locals.rutaInicio)
    : res.render("visitante/login", {mensaje: null, email: ""});
}
export async function ingresar(req, res) {
  try {
    const u = await A.login(req.body.email, req.body.password);
    await saveSession(req, u);
    res.redirect(
      u.rol === "supervisor"
        ? "/supervisor/cola"
        : u.rol === "tecnico"
          ? "/tecnico/bandeja"
          : "/usuario/tickets",
    );
  } catch (e) {
    if (!e.status) throw e;
    res
      .status(e.status)
      .render("visitante/login", {
        mensaje: e.message,
        email: typeof req.body.email === "string" ? req.body.email : "",
        bloqueado: e.status === 403,
        credenciales: e.status === 401,
      });
  }
}
export async function logout(req, res) {
  await destroySession(req);
  res.clearCookie("campus.sid");
  res.redirect("/login");
}
export function cuenta(req, res) {
  return res.render("visitante/cuenta", {app: "visitante"});
}
