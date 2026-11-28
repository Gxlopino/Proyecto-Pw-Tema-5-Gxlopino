// admin/apis/atencion_api.js
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

export function registrarAtencionApi(api) {
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

}
