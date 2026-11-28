// admin/apis/cola_api.js
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

export function registrarColaApi(api) {
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

}
