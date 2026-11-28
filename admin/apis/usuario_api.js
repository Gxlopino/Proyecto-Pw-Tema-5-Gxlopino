// admin/apis/usuario_api.js
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

export function registrarUsuarioApi(api) {
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

}
