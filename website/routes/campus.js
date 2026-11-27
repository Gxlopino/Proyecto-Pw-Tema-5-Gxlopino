// website/routes/campus.js
import { Router } from "express";
import {
  endpoint as out,
  saveSession,
  destroySession,
} from "../controllers/campus.js";
import * as A from "../services/accounts.js";
import * as C from "../services/catalog.js";
import * as T from "../services/tickets.js";
import { snapshot } from "../repositories/campus.js";
import { Usuario, Unidad, Sede, Ambiente, Categoria } from "../models/index.js";
import { requireValue as need } from "../services/common.js";
export const api = Router();
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
api.get(
  "/bootstrap",
  out((req) => snapshot(req.user)),
);
api.get(
  "/v1/unidades",
  out(async () =>
    (await Unidad.findAll({ order: [["nombre", "ASC"]] })).map((u) => u.nombre),
  ),
);
api.get(
  "/v1/registro/disponible",
  out(async (req) => ({
    disponible: !(await Usuario.findOne({
      where: {
        email: String(req.query.email || "")
          .trim()
          .toLowerCase(),
      },
    })),
  })),
);
api.post(
  "/v1/registro",
  out(async (req) => {
    const u = await A.register(req.body);
    await saveSession(req, u);
    return A.safeUser(u);
  }, 201),
);
api.get(
  "/v1/sessions",
  authenticated,
  out((req) => A.safeUser(req.user)),
);
api.post(
  "/v1/login",
  out(async (req) => {
    const u = await A.login(req.body.email, req.body.password);
    await saveSession(req, u);
    return A.safeUser(u);
  }),
);
api.post(
  "/v1/logout",
  authenticated,
  out(async (req) => {
    await destroySession(req);
    return true;
  }),
);
api.post(
  "/v1/invitaciones",
  role("supervisor"),
  out((req) => A.invite(req.body, req.user.id), 201),
);
api.get(
  "/v1/invitaciones/:token",
  out((req) => A.readInvitation(req.params.token)),
);
api.post(
  "/v1/invitaciones/:token/aceptar",
  out(async (req) => {
    const u = await A.acceptInvitation(req.params.token, req.body);
    await saveSession(req, u);
    return A.safeUser(u);
  }),
);
api.post(
  "/v1/invitaciones/:token/rechazar",
  out((req) => A.rejectInvitation(req.params.token)),
);
api.post(
  "/v1/recuperar",
  out((req) => A.requestRecovery(req.body.email)),
);
api.get(
  "/v1/recuperar/:token",
  out((req) => A.validateRecovery(req.params.token)),
);
api.post(
  "/v1/restablecer",
  out((req) => A.resetPassword(req.body)),
);
api.put(
  "/v1/cuenta",
  authenticated,
  out((req) => A.updateAccount(req.user.id, req.body)),
);
api.put(
  "/v1/cuenta/password",
  authenticated,
  out(async (req) => {
    const u = await A.changePassword(req.user.id, req.body);
    req.session.version = u.sessionVersion;
    await new Promise((resolve, reject) =>
      req.session.save((e) => (e ? reject(e) : resolve())),
    );
    return true;
  }),
);
api.use("/website", authenticated);
api.get(
  "/website/tickets/duplicado",
  role("usuario"),
  out((req) => T.duplicate(req.query, req.user)),
);
api.get(
  "/website/tickets",
  role("usuario"),
  out((req) => T.mine(req.query, req.user)),
);
api.post(
  "/website/tickets",
  role("usuario"),
  out((req) => T.create(req.body, req.user), 201),
);
api.get(
  "/website/tickets/:key",
  out((req) => T.detail(req.params.key, req.user)),
);
for (const [suffix, fn] of Object.entries({
  informacion: T.information,
  cancelar: T.cancel,
  reabrir: T.reopen,
}))
  api.post(
    `/website/tickets/:key/${suffix}`,
    role("usuario"),
    out((req) => fn(req.params.key, req.user, req.body)),
  );
api.use("/admin", authenticated);
api.get(
  "/admin/categorias",
  out((req) => C.categories(req.user, req.query)),
);
api.get(
  "/admin/categorias/:id",
  out(async (req) => {
    const c = await Categoria.findByPk(req.params.id);
    need(c, "Categoría no encontrada.", 404);
    return c;
  }),
);
api.post(
  "/admin/categorias",
  role("supervisor"),
  out((req) => C.saveCategory(null, req.body), 201),
);
api.put(
  "/admin/categorias/:id",
  role("supervisor"),
  out((req) => C.saveCategory(req.params.id, req.body)),
);
api.put(
  "/admin/categorias/:id/estado",
  role("supervisor"),
  out((req) => C.categoryStatus(req.params.id, req.body)),
);
api.delete(
  "/admin/categorias/:id",
  role("supervisor"),
  out((req) => C.deleteCategory(req.params.id)),
);
api.get(
  "/admin/sedes",
  out(() => Sede.findAll({ order: [["id", "ASC"]] })),
);
api.post(
  "/admin/sedes",
  role("supervisor"),
  out((req) => C.saveSite(null, req.body), 201),
);
api.put(
  "/admin/sedes/:id",
  role("supervisor"),
  out((req) => C.saveSite(req.params.id, req.body)),
);
api.delete(
  "/admin/sedes/:id",
  role("supervisor"),
  out((req) => C.deleteSite(req.params.id)),
);
api.get(
  "/admin/ambientes",
  out(async (req) => {
    const s = await snapshot(req.user);
    return s.ambientes
      .map((a) => ({
        ...a,
        sede: s.sedes.find((x) => x.id === a.sedeId)?.nombre || "—",
        ticketsAbiertos: s.tickets.filter(
          (t) =>
            t.ambienteId === a.id &&
            !["cerrado", "cancelado"].includes(t.estado),
        ).length,
      }))
      .filter((a) => !req.query.sedeId || a.sedeId === Number(req.query.sedeId))
      .filter((a) => !req.query.pabellon || a.pabellon === req.query.pabellon)
      .filter((a) => !req.query.tipo || a.tipo === req.query.tipo)
      .filter(
        (a) =>
          !req.query.busqueda ||
          [a.codigo, a.nombre].some((s) =>
            s.toLowerCase().includes(req.query.busqueda.toLowerCase()),
          ),
      );
  }),
);
api.post(
  "/admin/ambientes",
  role("supervisor"),
  out((req) => C.saveEnvironment(null, req.body), 201),
);
api.put(
  "/admin/ambientes/:id",
  role("supervisor"),
  out((req) => C.saveEnvironment(req.params.id, req.body)),
);
api.delete(
  "/admin/ambientes/:id",
  role("supervisor"),
  out((req) => C.deleteEnvironment(req.params.id)),
);
api.get(
  "/admin/tecnico-categorias",
  role("supervisor"),
  out((req) => C.matrix(req.user)),
);
api.put(
  "/admin/tecnico-categorias",
  role("supervisor"),
  out((req) => C.saveMatrix(req.body)),
);
api.get(
  "/admin/cola",
  role("supervisor"),
  out((req) => T.queue(req.user, req.query)),
);
api.post(
  "/admin/cola/lote/asignar",
  role("supervisor"),
  out((req) => T.assignBatch(req.user, req.body)),
);
api.post(
  "/admin/cola/devolver",
  role("supervisor"),
  out((req) => T.returnQueue(req.user, req.body)),
);
api.post(
  "/admin/cola/prioridad",
  role("supervisor"),
  out((req) => T.priority(req.user, req.body)),
);
api.post(
  "/admin/cola/:key/asignar",
  role("supervisor"),
  out((req) => T.assign(req.params.key, req.user, req.body)),
);
api.get(
  "/admin/bandeja",
  role("tecnico"),
  out((req) => T.inbox(req.user, req.query)),
);
api.get(
  "/admin/bandeja/disponibles",
  role("tecnico"),
  out((req) => T.available(req.user)),
);
api.post(
  "/admin/bandeja/:key/tomar",
  role("tecnico"),
  out((req) => T.assign(req.params.key, req.user, {}, true)),
);
api.get(
  "/admin/bandejas",
  role("supervisor"),
  out((req) => T.inboxes(req.user)),
);
api.get(
  "/admin/tickets/:key/bitacora",
  out((req) => T.entries(req.params.key, req.user)),
);
api.post(
  "/admin/tickets/:key/bitacora",
  role("tecnico", "supervisor"),
  out((req) => T.addEntry(req.params.key, req.user, req.body), 201),
);
api.get(
  "/admin/tickets/:key/historial",
  out((req) => T.history(req.params.key, req.user)),
);
api.post(
  "/admin/tickets/:key/estado",
  role("tecnico", "supervisor"),
  out((req) => T.state(req.params.key, req.user, req.body)),
);
api.post(
  "/admin/tickets/:key/cerrar",
  role("tecnico", "supervisor"),
  out((req) => T.close(req.params.key, req.user, req.body)),
);
