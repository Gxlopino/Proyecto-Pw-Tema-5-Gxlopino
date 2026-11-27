// tests/integration.test.js
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { Op } from "sequelize";
import { app, sessionPool, sessionStore } from "../app.js";
import * as M from "../website/models/index.js";
import { createRecovery, digest } from "../website/services/accounts.js";
const stamp = Date.now(),
  prefix = `qa${stamp}`,
  pass = "PruebaSegura2026!",
  userMail = `${prefix}@aloe.ulima.edu.pe`,
  otherMail = `${prefix}b@aloe.ulima.edu.pe`,
  techMail = `${prefix}t@ulima.edu.pe`;
const post = (agent, url, body, status = 200) =>
  agent.post(url).send(body).expect(status);
let categoryIds = [],
  siteId,
  envId;
test("Integración real PostgreSQL: HU-1 a HU-5 y controles de acceso", async (t) => {
  const user = request.agent(app),
    other = request.agent(app),
    supervisor = request.agent(app),
    tech = request.agent(app),
    anonymous = request(app);
  let code;
  try {
    await t.test("Salud, páginas, archivos y acceso anónimo", async () => {
      await anonymous.get("/healthz").expect(200);
      for (const url of [
        "/",
        "/login",
        "/registro",
        "/recuperar",
        "/dist/js/usuario.js",
        "/dist/css/app.css",
      ])
        await anonymous.get(url).expect(200);
      await anonymous.get("/api/website/tickets").expect(401);
      const s = (await anonymous.get("/api/bootstrap").expect(200)).body.data;
      assert.equal(s.usuarios.length, 0);
      assert.equal(s.tickets.length, 0);
    });
    await t.test(
      "Registro, sesión persistente, login y autorización por rol",
      async () => {
        const unit = (await anonymous.get("/api/v1/unidades")).body.data[0];
        for (const [agent, email] of [
          [user, userMail],
          [other, otherMail],
        ]) {
          const u = (
            await post(
              agent,
              "/api/v1/registro",
              {
                nombres: "Prueba",
                apellidos: "Automatizada",
                email,
                password: pass,
                confirmar: pass,
                telefono: "999888777",
                unidad: unit,
                vinculo: "alumno",
                terminos: true,
                rol: "supervisor",
              },
              201,
            )
          ).body.data;
          assert.equal(u.rol, "usuario");
          assert.equal(u.passwordHash, undefined);
          await agent.get("/api/v1/sessions").expect(200);
        }
        await post(supervisor, "/api/v1/login", {
          email: "lmendoza@ulima.edu.pe",
          password: "SoloPruebas2026!",
        });
        await user
          .post("/api/admin/categorias")
          .send({ nombre: "Ataque" })
          .expect(403);
        await user.get("/supervisor/cola").expect(403);
      },
    );
    await t.test("Catálogo CRUD, jerarquía, unicidad y sedes", async () => {
      const site = (
        await post(
          supervisor,
          "/api/admin/sedes",
          { nombre: prefix, direccion: "Datos ficticios", activa: true },
          201,
        )
      ).body.data;
      siteId = site.id;
      const env = (
        await post(
          supervisor,
          "/api/admin/ambientes",
          {
            codigo: `Q${stamp % 10000000}`,
            nombre: "Ambiente QA",
            sedeId: siteId,
            tipo: "aula",
            pabellon: "QA",
            piso: 1,
            capacidad: 10,
            activo: true,
          },
          201,
        )
      ).body.data;
      envId = env.id;
      const parent = (
        await post(
          supervisor,
          "/api/admin/categorias",
          {
            nombre: prefix,
            parentId: null,
            prioridadDefecto: "media",
            tiempoEsperadoHoras: 24,
            descripcion: "Prueba",
            activa: true,
          },
          201,
        )
      ).body.data;
      categoryIds.push(parent.id);
      const child = (
        await post(
          supervisor,
          "/api/admin/categorias",
          {
            nombre: prefix + "sub",
            parentId: parent.id,
            prioridadDefecto: "alta",
            tiempoEsperadoHoras: 8,
            descripcion: "Prueba",
            activa: true,
          },
          201,
        )
      ).body.data;
      categoryIds.push(child.id);
      await post(
        supervisor,
        "/api/admin/categorias",
        {
          nombre: prefix + "nivel3",
          parentId: child.id,
          prioridadDefecto: "alta",
          tiempoEsperadoHoras: 8,
          activa: true,
        },
        400,
      );
      await supervisor.delete(`/api/admin/sedes/${siteId}`).expect(409);
    });
    await t.test(
      "Invitación, activación, especialidades y habilitación",
      async () => {
        const inv = (
          await post(
            supervisor,
            "/api/v1/invitaciones",
            {
              nombres: "Técnico",
              apellidos: "Prueba",
              email: techMail,
              rol: "tecnico",
            },
            201,
          )
        ).body.data;
        const stored = await M.Invitacion.findByPk(inv.id);
        assert.notEqual(stored.tokenHash, inv.token);
        await anonymous.get(`/api/v1/invitaciones/${inv.token}`).expect(200);
        const u = (
          await post(tech, `/api/v1/invitaciones/${inv.token}/aceptar`, {
            password: pass,
            confirmar: pass,
            telefono: "999888666",
            especialidades: [categoryIds[0]],
          })
        ).body.data;
        const current = (await supervisor.get("/api/admin/tecnico-categorias"))
          .body.data;
        const matrix = Object.fromEntries(
          current.filas.map((f) => [f.id, f.categorias]),
        );
        matrix[u.id] = [categoryIds[0]];
        await supervisor
          .put("/api/admin/tecnico-categorias")
          .send(matrix)
          .expect(200);
        await post(
          anonymous,
          `/api/v1/invitaciones/${inv.token}/aceptar`,
          {
            password: pass,
            confirmar: pass,
            telefono: "999888666",
            especialidades: [categoryIds[0]],
          },
          409,
        );
      },
    );
    await t.test(
      "Crear ticket, duplicado, filtros, IDOR y validación",
      async () => {
        const body = {
          asunto: "Incidencia QA controlada",
          descripcion: "Descripción ficticia suficiente para pruebas.",
          categoriaId: categoryIds[0],
          subcategoriaId: categoryIds[1],
          ambienteId: envId,
          prioridadSugerida: "critica",
        };
        const ticket = (await post(user, "/api/website/tickets", body, 201))
          .body.data;
        code = ticket.codigo;
        assert.equal(ticket.prioridad, "alta");
        assert.equal(ticket.estado, "abierto");
        await other.get(`/api/website/tickets/${code}`).expect(403);
        await other.get(`/api/admin/tickets/${code}/historial`).expect(403);
        assert.equal(
          (await other.get("/api/bootstrap")).body.data.tickets.length,
          0,
        );
        assert.equal(
          (
            await user
              .get("/api/website/tickets/duplicado")
              .query({ ambienteId: envId, categoriaId: categoryIds[0] })
          ).body.data.codigo,
          code,
        );
        assert.equal(
          (
            await user
              .get("/api/website/tickets")
              .query({ estado: "en_curso", codigo: code })
          ).body.data.length,
          1,
        );
        await post(
          user,
          "/api/website/tickets",
          { ...body, subcategoriaId: categoryIds[0] },
          400,
        );
        await post(
          user,
          `/api/website/tickets/${code}/informacion`,
          { texto: "Información adicional ficticia." },
          200,
        );
        await supervisor
          .put(`/api/admin/categorias/${categoryIds[0]}/estado`)
          .send({ activa: false })
          .expect(409);
        await supervisor
          .put(`/api/admin/categorias/${categoryIds[0]}/estado`)
          .send({ activa: false, confirmar: true })
          .expect(200);
        await post(user, "/api/website/tickets", body, 400);
        await supervisor
          .put(`/api/admin/categorias/${categoryIds[0]}/estado`)
          .send({ activa: true })
          .expect(200);
      },
    );
    await t.test(
      "Autoasignación concurrente y controles de asignación",
      async () => {
        const results = await Promise.all([
          tech.post(`/api/admin/bandeja/${code}/tomar`),
          tech.post(`/api/admin/bandeja/${code}/tomar`),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        await post(
          user,
          `/api/website/tickets/${code}/cancelar`,
          { motivo: "No autorizado" },
          409,
        );
        await post(
          user,
          `/api/admin/tickets/${code}/estado`,
          { estado: "en_atencion" },
          403,
        );
        await tech.get("/api/admin/bandeja").expect(200);
        assert.ok(
          Array.isArray((await tech.get("/api/admin/bandeja")).body.data.lista),
        );
        const changed = await post(supervisor, "/api/admin/cola/prioridad", {
          codigos: [code],
          nueva: "critica",
          motivo: "Ajuste ficticio de prioridad",
        });
        assert.deepEqual(changed.body.data.cambiados, [code]);
      },
    );
    await t.test(
      "Atención, notas públicas/internas, espera y cierre",
      async () => {
        await post(tech, `/api/admin/tickets/${code}/estado`, {
          estado: "en_atencion",
        });
        await post(
          tech,
          `/api/admin/tickets/${code}/bitacora`,
          { tipo: "interno", texto: "NOTA PRIVADA QA" },
          201,
        );
        await post(
          tech,
          `/api/admin/tickets/${code}/bitacora`,
          { tipo: "publico", texto: "Avance visible al solicitante." },
          201,
        );
        const notes = (
          await user
            .get(`/api/admin/tickets/${code}/bitacora`)
            .query({ incluirInternas: true })
        ).body.data;
        assert.ok(notes.every((n) => n.tipo === "publico"));
        assert.ok(
          !JSON.stringify((await user.get("/api/bootstrap")).body).includes(
            "NOTA PRIVADA QA",
          ),
        );
        const tomorrow = new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10);
        await post(tech, `/api/admin/tickets/${code}/estado`, {
          estado: "en_espera",
          motivoEspera: "Espera de repuesto ficticio",
          fechaRetorno: tomorrow,
        });
        await post(
          tech,
          `/api/admin/tickets/${code}/estado`,
          { estado: "resuelto" },
          409,
        );
        await post(tech, `/api/admin/tickets/${code}/estado`, {
          estado: "en_atencion",
        });
        const closed = (
          await post(tech, `/api/admin/tickets/${code}/cerrar`, {
            solucion: "Se realizó la corrección de la incidencia ficticia.",
          })
        ).body.data;
        assert.equal(closed.estado, "cerrado");
        assert.ok(closed.cerradoEn);
        assert.ok(closed.tiempoAtencionMin >= 0);
        assert.ok(
          (
            await user.get(`/api/admin/tickets/${code}/historial`)
          ).body.data.eventos.some((e) => e.estado === "en_espera"),
        );
        await post(
          tech,
          `/api/admin/tickets/${code}/bitacora`,
          { tipo: "publico", texto: "No debe agregarse" },
          409,
        );
      },
    );
    await t.test(
      "Reapertura, devolución, reasignación y cierre repetido",
      async () => {
        await post(user, `/api/website/tickets/${code}/reabrir`, {
          motivo: "La falla reapareció durante la prueba.",
        });
        const returned = await post(supervisor, "/api/admin/cola/devolver", {
          codigos: [code],
          motivo: "Revisión de asignación",
        });
        assert.deepEqual(returned.body.data.devueltos, [code]);
        await post(
          user,
          `/api/website/tickets/${code}/cancelar`,
          { motivo: "Ya fue asignado" },
          409,
        );
        const techId = (await tech.get("/api/v1/sessions")).body.data.id;
        const batch = (
          await post(supervisor, "/api/admin/cola/lote/asignar", {
            codigos: [code],
            tecnicoId: techId,
            nota: "Prueba de lote",
          })
        ).body.data;
        assert.deepEqual(batch.asignados, [code]);
        await post(tech, `/api/admin/tickets/${code}/estado`, {
          estado: "en_atencion",
        });
        await post(tech, `/api/admin/tickets/${code}/estado`, {
          estado: "resuelto",
        });
        await post(tech, `/api/admin/tickets/${code}/cerrar`, {
          solucion: "Segunda solución ficticia verificada.",
        });
        const ticket = await M.Ticket.findOne({ where: { codigo: code } });
        await M.Cierre.update(
          { cerradoEn: new Date(Date.now() - 8 * 86400000) },
          { where: { ticketId: ticket.id } },
        );
        await post(
          user,
          `/api/website/tickets/${code}/reabrir`,
          { motivo: "Fuera de plazo de reapertura" },
          409,
        );
      },
    );
    await t.test(
      "Recuperación de un uso, invalidación de sesión y bloqueo",
      async () => {
        const response = (
          await post(anonymous, "/api/v1/recuperar", { email: userMail })
        ).body.data;
        assert.equal(response.enlace, null);
        const link = await createRecovery(userMail),
          token = new URL(link, "http://localhost").searchParams.get("token");
        const rec = await M.Recuperacion.findOne({
          where: { tokenHash: digest(token) },
        });
        assert.ok(rec);
        assert.notEqual(rec.tokenHash, token);
        const newer = "OtraPruebaSegura2026!";
        await post(anonymous, "/api/v1/restablecer", {
          token,
          password: newer,
          confirmar: newer,
        });
        await post(
          anonymous,
          "/api/v1/restablecer",
          { token, password: newer, confirmar: newer },
          404,
        );
        await user.get("/api/v1/sessions").expect(401);
        await post(user, "/api/v1/login", { email: userMail, password: newer });
        for (let i = 0; i < 5; i++)
          await post(
            anonymous,
            "/api/v1/login",
            { email: otherMail, password: "Incorrecta2026" },
            i === 4 ? 403 : 401,
          );
        await post(
          anonymous,
          "/api/v1/login",
          { email: otherMail, password: pass },
          403,
        );
        await anonymous
          .post("/api/v1/login")
          .set("Origin", "https://otro.example")
          .send({ email: userMail, password: newer })
          .expect(403);
      },
    );
  } finally {
    const people = await M.Usuario.findAll({
      where: { email: { [Op.like]: prefix + "%" } },
      raw: true,
    });
    const ids = people.map((u) => u.id);
    await M.db.transaction(async (transaction) => {
      await M.Ticket.destroy({
        where: { solicitanteId: { [Op.in]: ids } },
        transaction,
      });
      await M.Invitacion.destroy({
        where: { email: { [Op.like]: prefix + "%" } },
        transaction,
      });
      await M.Usuario.destroy({ where: { id: { [Op.in]: ids } }, transaction });
      for (const id of [...categoryIds].reverse())
        await M.Categoria.destroy({ where: { id }, transaction });
      if (envId)
        await M.Ambiente.destroy({ where: { id: envId }, transaction });
      if (siteId) await M.Sede.destroy({ where: { id: siteId }, transaction });
      await M.db.query(
        "DELETE FROM sesiones WHERE sess->>'userId' = ANY(ARRAY[:ids]::text[])",
        { replacements: { ids: ids.map(String) }, transaction },
      );
    });
    await sessionStore.close();
    await sessionPool.end();
    await M.db.close();
  }
});
