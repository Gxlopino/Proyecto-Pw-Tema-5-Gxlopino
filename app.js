// app.js
import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import engine from "ejs-mate";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connection } from "./configs/database.js";
import db from "./configs/database.js";
import { Usuario } from "./website/models/index.js";
import { api } from "./website/routes/campus.js";
import * as A from "./website/services/accounts.js";
import { snapshot } from "./website/repositories/campus.js";
import { saveSession, destroySession } from "./website/controllers/campus.js";
import { ServiceError } from "./website/services/common.js";
const root = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const production = process.env.NODE_ENV === "production";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  throw new Error(
    "Configura SESSION_SECRET con al menos 32 caracteres en .env.",
  );
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(root, "views"));
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  if (req.path.startsWith("/api/") || !path.extname(req.path))
    res.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(root, "public"), { index: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== `${req.protocol}://${req.get("host")}`)
    )
      throw new ServiceError("Origen no autorizado.", 403);
  }
  next();
});
export const sessionPool = new pg.Pool({
  ...connection,
  max: 2,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 10000,
});
sessionPool.on("error", () => console.error("Error en el pool de sesiones."));
const Store = connectPg(session);
export const sessionStore = new Store({
  pool: sessionPool,
  tableName: "sesiones",
  createTableIfMissing: false,
  pruneSessionInterval: false,
  errorLog: () => console.error("No se pudo persistir la sesión."),
});
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "campus.sid",
    cookie: {
      secure: production,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 86400000,
    },
  }),
);
app.use(async (req, res, next) => {
  req.user = null;
  if (req.session.userId) {
    const user = await Usuario.findByPk(req.session.userId);
    if (
      user?.estado === "activo" &&
      user.sessionVersion === req.session.version
    )
      req.user = user;
    else await destroySession(req);
  }
  const start = (rol) =>
    rol === "supervisor"
      ? "/supervisor/cola"
      : rol === "tecnico"
        ? "/tecnico/bandeja"
        : "/usuario/tickets";
  Object.assign(res.locals, {
    title: "Mesa de Ayuda · Campus",
    siteTitle: "Mesa de Ayuda",
    successMessage: [],
    errorMessage: [],
    isAuthenticated: !!req.user,
    role: req.user?.rol,
    username: req.user?.email,
    session: req.session,
    rutaInicio: req.user ? start(req.user.rol) : "/login",
    BASE_URL: "/",
    STATIC_URL: "/",
    FILES_URL: "/",
    ACCESS_URL: "/",
  });
  next();
});
app.get("/healthz", async (req, res) => {
  await db.authenticate();
  res.json({ status: "ok", database: "connected" });
});
app.use("/api", api);
app.get("/", async (req, res) => {
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
});
app.get("/login", (req, res) =>
  req.user
    ? res.redirect(res.locals.rutaInicio)
    : res.render("visitante/login", { mensaje: null, email: "" }),
);
app.post("/login", async (req, res) => {
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
});
app.get("/logout", async (req, res) => {
  await destroySession(req);
  res.clearCookie("campus.sid");
  res.redirect("/login");
});
app.get(["/registro", "/recuperar", "/invitacion/:token"], (req, res) =>
  res.render("visitante/cuenta", { app: "visitante" }),
);
for (const rol of ["usuario", "tecnico", "supervisor"])
  app.get(
    new RegExp(`^/${rol}(?:/.*)?$`),
    (req, res, next) => {
      if (!req.user) return res.redirect("/login");
      if (req.user.rol !== rol)
        return res
          .status(403)
          .render("403", {
            seccion: "esta sección",
            rol: req.user.rol,
            exclusivo: `Acceso exclusivo para ${rol}.`,
          });
      next();
    },
    (req, res) => res.render(`${rol}/home`, { rol }),
  );
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res
      .status(404)
      .json({
        success: false,
        message: "Recurso no encontrado.",
        data: null,
        error: null,
      });
  res.status(404).render("404", { message: "La página no existe." });
});
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const code = err.original?.code;
  const status =
    err.status || (["23505", "23503", "23514"].includes(code) ? 409 : 500);
  const message =
    status === 500
      ? "No se pudo completar la operación. Revisa la configuración y conexión del servidor."
      : code === "23505"
        ? "Ya existe un registro con esos datos."
        : code === "23503"
          ? "El registro está relacionado con otros datos."
          : code === "23514"
            ? "Los datos no cumplen las restricciones."
            : err.message;
  if (status === 500) console.error("Error de servidor:", err.name, code || "");
  res
    .status(status)
    .json({ success: false, message, data: null, error: err.errores || null });
});
export default app;
