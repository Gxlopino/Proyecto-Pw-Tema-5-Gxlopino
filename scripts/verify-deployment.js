// scripts/verify-deployment.js
import { vercelEntry } from "./vercel-cli.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as M from "../website/models/index.js";
const base = process.argv[2] || "https://mesa-ayuda-tema5.vercel.app";
assert.match(base, /^https:\/\/mesa-ayuda-tema5(?:-[a-z0-9-]+)?\.vercel\.app$/);
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mesa-qa-")),
  prefix = `deployqa${Date.now()}`,
  mail = prefix + "@aloe.ulima.edu.pe",
  pwd = "SoloPruebas2026!";
async function call(
  route,
  { jar = "anon", method = "GET", body, status = 200 } = {},
) {
  const cookie = path.join(dir, jar + ".cookies");
  const args = [
    vercelEntry(),
    "curl",
    base + route,
    "--scope",
    "team_WXL6qKsjPwAepNetjndewhi8",
    "--",
    "--silent",
    "--show-error",
    "--max-time",
    "60",
    "--cookie",
    cookie,
    "--cookie-jar",
    cookie,
    "--write-out",
    "\n%{http_code}",
    "--request",
    method,
  ];
  let input;
  if (body) {
    args.push(
      "--header",
      "Content-Type:application/json",
      "--data-binary",
      "@-",
    );
    input = JSON.stringify(body);
  }
  const result = spawnSync(process.execPath, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 3 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Fallo de transporte en ${route}`);
  const lines = result.stdout.trim().split("\n"),
    code = Number(lines.pop()),
    text = lines.join("\n");
  assert.equal(code, status, `${method} ${route}: HTTP ${code}`);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = text;
  }
  console.log(`${method} ${route}: ${code}`);
  return value;
}
try {
  assert.equal((await call("/healthz")).database, "connected");
  const home = await call("/");
  assert.ok(home.includes("Mesa de Ayuda"));
  const login = await call("/login");
  assert.ok(login.includes("SoloPruebas2026!"));
  for (const file of [
    "/dist/js/usuario.js",
    "/dist/js/supervisor.js",
    "/dist/js/tecnico.js",
    "/dist/js/visitante.js",
    "/dist/css/app.css",
    "/assets/css/site.css",
    "/assets/img/claude-bailando.svg",
  ])
    await call(file);
  await call("/api/website/tickets", { status: 401 });
  const boot = (await call("/api/bootstrap")).data;
  assert.equal(boot.usuarios.length, 0);
  const reg = (
    await call("/api/v1/registro", {
      jar: "user",
      method: "POST",
      status: 201,
      body: {
        nombres: "Prueba",
        apellidos: "Despliegue",
        email: mail,
        password: pwd,
        confirmar: pwd,
        telefono: "999777666",
        unidad: boot.unidades[0],
        vinculo: "alumno",
        terminos: true,
      },
    })
  ).data;
  assert.equal(
    (await call("/api/v1/sessions", { jar: "user" })).data.id,
    reg.id,
  );
  await call("/usuario/tickets", { jar: "user" });
  const ticket = (
    await call("/api/website/tickets", {
      jar: "user",
      method: "POST",
      status: 201,
      body: {
        asunto: "Incidencia ficticia de despliegue",
        descripcion:
          "Registro temporal para verificar lectura y escritura real.",
        categoriaId: 1,
        subcategoriaId: 9,
        ambienteId: 1,
        prioridadSugerida: "alta",
      },
    })
  ).data;
  await call("/api/v1/login", {
    jar: "super",
    method: "POST",
    body: { email: "lmendoza@ulima.edu.pe", password: pwd },
  });
  await call("/supervisor/cola", { jar: "super" });
  const tech = await M.Usuario.findOne({
    where: { email: "jparedes@ulima.edu.pe" },
  });
  await call(`/api/admin/cola/${ticket.codigo}/asignar`, {
    jar: "super",
    method: "POST",
    body: { tecnicoId: tech.id },
  });
  const changed = (await call('/api/admin/cola/prioridad', {jar:'super',method:'POST',body:{codigos:[ticket.codigo],nueva:'critica',motivo:'Prioridad ficticia de verificación'}})).data;
  assert.deepEqual(changed.cambiados,[ticket.codigo]);
  const returned = (await call('/api/admin/cola/devolver', {jar:'super',method:'POST',body:{codigos:[ticket.codigo],motivo:'Devolución ficticia de verificación'}})).data;
  assert.deepEqual(returned.devueltos,[ticket.codigo]);
  await call(`/api/admin/cola/${ticket.codigo}/asignar`,{jar:'super',method:'POST',body:{tecnicoId:tech.id}});
  await call("/api/v1/login", {
    jar: "tech",
    method: "POST",
    body: { email: "jparedes@ulima.edu.pe", password: pwd },
  });
  await call("/tecnico/bandeja", { jar: "tech" });
  await call(`/api/admin/tickets/${ticket.codigo}/estado`, {
    jar: "tech",
    method: "POST",
    body: { estado: "en_atencion" },
  });
  await call(`/api/admin/tickets/${ticket.codigo}/bitacora`, {
    jar: "tech",
    method: "POST",
    status: 201,
    body: { tipo: "interno", texto: "Nota interna temporal de verificación." },
  });
  assert.ok(
    (
      await call(
        `/api/admin/tickets/${ticket.codigo}/bitacora?incluirInternas=true`,
        { jar: "user" },
      )
    ).data.every((x) => x.tipo === "publico"),
  );
  await call("/api/admin/categorias", {
    jar: "user",
    method: "POST",
    status: 403,
    body: { nombre: "No autorizado" },
  });
  const closed = (
    await call(`/api/admin/tickets/${ticket.codigo}/cerrar`, {
      jar: "tech",
      method: "POST",
      body: { solucion: "Se verificó la solución ficticia desde Vercel." },
    })
  ).data;
  assert.equal(closed.estado, "cerrado");
  assert.equal(
    (await call(`/api/website/tickets/${ticket.codigo}`, { jar: "user" })).data
      .estado,
    "cerrado",
  );
  for (const jar of ["user", "super", "tech"])
    await call("/api/v1/logout", { jar, method: "POST" });
  await call("/api/v1/sessions", { jar: "user", status: 401 });
  console.log(
    "Verificación desplegada completada: páginas, archivos, tres roles, escritura, asignación, bitácora, cierre y logout.",
  );
} finally {
  const user = await M.Usuario.findOne({ where: { email: mail } });
  if (user) {
    await M.db.transaction(async (transaction) => {
      await M.Ticket.destroy({
        where: { solicitanteId: user.id },
        transaction,
      });
      await user.destroy({ transaction });
      await M.db.query("DELETE FROM sesiones WHERE sess->>'userId' = :id", {
        replacements: { id: String(user.id) },
        transaction,
      });
    });
  }
  await fs.rm(dir, { recursive: true, force: true });
  await M.db.close();
  console.log("Registros temporales y cookies de prueba eliminados.");
}
