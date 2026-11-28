// La sesión y req.user se validan en app.js contra PostgreSQL.
export function soloLogueado(req, res, next) {
  if (!req.user) return res.redirect("/login");
  next();
}
const soloRol = (rol) => (req, res, next) => {
  if (!req.user) return res.redirect("/login");
  if (req.user.rol !== rol) return res.status(403).render("403", {
    seccion: "esta sección", rol: req.user.rol,
    exclusivo: `Acceso exclusivo para ${rol}.`,
  });
  next();
};
export const soloUsuario = soloRol("usuario");
export const soloTecnico = soloRol("tecnico");
export const soloSupervisor = soloRol("supervisor");
export function redireccionarSiLogueado(req, res, next) {
  if (req.user) return res.redirect(res.locals.rutaInicio);
  next();
}
