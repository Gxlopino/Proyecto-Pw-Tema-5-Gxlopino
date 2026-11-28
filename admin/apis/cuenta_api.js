// admin/apis/cuenta_api.js
import {
  endpoint as out,
  saveSession,
  destroySession,
} from "../controllers/sesion_controllers.js";
import * as A from "../services/cuenta_services.js";
import * as C from "../services/catalogo_services.js";
import * as T from "../services/tickets_services.js";
import { snapshot } from "../repositories/mesa_repositories.js";
import { Usuario, Unidad, Sede, Ambiente, Categoria } from "../models/index.js";
import { requireValue as need } from "../services/common.js";
import { authenticated, role } from "../../configs/api_middlewares.js";

export function registrarCuentaApi(api) {
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

}
