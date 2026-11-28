import { requireValue as need } from "../admin/services/common.js";
export const authenticated = (req, res, next) => {
  need(req.user, "Debes iniciar sesión.", 401);
  next();
};
export const role =
  (...roles) =>
  (req, res, next) => {
    need(req.user, "Debes iniciar sesión.", 401);
    need(
      roles.includes(req.user.rol),
      "No tienes permiso para esta operación.",
      403,
    );
    next();
  };
