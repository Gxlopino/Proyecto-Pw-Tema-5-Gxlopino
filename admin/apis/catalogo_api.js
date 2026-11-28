// admin/apis/catalogo_api.js
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

export function registrarCatalogoApi(api) {
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

}
