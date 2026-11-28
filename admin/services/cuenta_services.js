// admin/services/cuenta_services.js
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import {
  db,
  Usuario,
  Unidad,
  Especialidad,
  Invitacion,
  Recuperacion,
  Categoria,
  Ambiente,
} from "../models/index.js";
import { requireValue as need, text, ServiceError, plain } from "./common.js";
export const digest = (s) =>
  crypto.createHash("sha256").update(String(s)).digest("hex");
export function password(p, c) {
  need(
    typeof p === "string" &&
      p.length >= 8 &&
      p.length <= 72 &&
      /[A-Z]/.test(p) &&
      /[0-9]/.test(p),
    "Mínimo 8 caracteres con mayúscula y número; máximo 72.",
    400,
    "password",
  );
  need(p === c, "Las contraseñas no coinciden.", 400, "confirmar");
}
const email = (e) => {
  need(
    typeof e === "string" &&
      /^[a-z0-9._-]+@(aloe\.)?ulima\.edu\.pe$/i.test(e.trim()),
    "Usa tu correo institucional.",
    400,
    "email",
  );
  return e.trim().toLowerCase();
};
function phone(p) {
  need(
    typeof p === "string" && /^9\d{2}\s?\d{3}\s?\d{3}$/.test(p.trim()),
    "Ingresa un celular de 9 dígitos.",
    400,
    "telefono",
  );
  return p.trim();
}
export async function safeUser(user, transaction) {
  const u = plain(user);
  if (!u) return null;
  const unit = u.unidadId
    ? await Unidad.findByPk(u.unidadId, { transaction })
    : null;
  const specs = await Especialidad.findAll({
    where: { usuarioId: u.id },
    transaction,
  });
  return {
    id: u.id,
    nombres: u.nombres,
    apellidos: u.apellidos,
    email: u.email,
    telefono: u.telefono,
    unidad: unit?.nombre || "",
    vinculo: u.vinculo,
    rol: u.rol,
    estado: u.estado,
    ambienteHabitualId: u.ambienteHabitualId,
    creadoEn: u.creadoEn,
    ultimoAcceso: u.ultimoAcceso,
    especialidades: specs.map((s) => s.categoriaId),
  };
}
export async function login(mail, pass) {
  const correo = email(mail);
  need(
    typeof pass === "string" && pass.length > 0 && pass.length <= 72,
    "Ingresa tu contraseña.",
  );
  const result = await db.transaction(async (transaction) => {
    const u = await Usuario.findOne({
      where: { email: correo },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!u) {
      await bcrypt.compare(
        pass,
        "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      );
      return {
        error: new ServiceError("Correo o contraseña incorrectos.", 401),
      };
    }
    if (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date())
      return {
        error: new ServiceError(
          "Cuenta bloqueada temporalmente durante 15 minutos.",
          403,
        ),
      };
    if (u.estado !== "activo")
      return { error: new ServiceError("Cuenta inactiva o bloqueada.", 403) };
    if (!(await bcrypt.compare(pass, u.passwordHash))) {
      const fails = (u.bloqueadoHasta ? 0 : u.intentosFallidos) + 1;
      await u.update(
        {
          intentosFallidos: fails >= 5 ? 0 : fails,
          bloqueadoHasta: fails >= 5 ? new Date(Date.now() + 900000) : null,
        },
        { transaction },
      );
      return {
        error: new ServiceError(
          fails >= 5
            ? "Cuenta bloqueada temporalmente durante 15 minutos."
            : "Correo o contraseña incorrectos.",
          fails >= 5 ? 403 : 401,
        ),
      };
    }
    await u.update(
      { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
      { transaction },
    );
    return { user: u };
  });
  if (result.error) throw result.error;
  return result.user;
}
async function identity(data, transaction) {
  const nombres = text(data.nombres, 1, 60, "nombres"),
    apellidos = text(data.apellidos, 1, 60, "apellidos"),
    telefono = phone(data.telefono);
  const unit = await Unidad.findOne({
    where: { nombre: data.unidad },
    transaction,
  });
  need(unit, "Selecciona tu unidad.", 400, "unidad");
  return { nombres, apellidos, telefono, unidadId: unit.id };
}
export async function register(data) {
  password(data.password, data.confirmar);
  need(data.terminos === true, "Debes aceptar los términos.", 400, "terminos");
  need(
    ["alumno", "docente", "administrativo", "otro"].includes(data.vinculo),
    "Vínculo no válido.",
  );
  return db.transaction(async (transaction) => {
    const values = await identity(data, transaction);
    return Usuario.create(
      {
        ...values,
        email: email(data.email),
        passwordHash: await bcrypt.hash(data.password, 12),
        vinculo: data.vinculo,
        rol: "usuario",
        estado: "activo",
        creadoEn: new Date(),
        ultimoAcceso: new Date(),
        intentosFallidos: 0,
        sessionVersion: 1,
      },
      { transaction },
    );
  });
}
export async function updateAccount(id, data) {
  return db.transaction(async (transaction) => {
    const u = await Usuario.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const values = await identity(
      {
        ...data,
        unidad:
          data.unidad ||
          (await Unidad.findByPk(u.unidadId, { transaction }))?.nombre,
      },
      transaction,
    );
    let ambienteHabitualId = data.ambienteHabitualId
      ? Number(data.ambienteHabitualId)
      : null;
    if (ambienteHabitualId)
      need(
        await Ambiente.findByPk(ambienteHabitualId, { transaction }),
        "Ambiente no válido.",
      );
    await u.update({ ...values, ambienteHabitualId }, { transaction });
    return safeUser(u, transaction);
  });
}
export async function changePassword(id, data) {
  password(data.nueva, data.confirmar);
  return db.transaction(async (transaction) => {
    const u = await Usuario.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    need(
      typeof data.actual === "string" &&
        (await bcrypt.compare(data.actual, u.passwordHash)),
      "La contraseña actual no es correcta.",
      400,
      "actual",
    );
    need(data.actual !== data.nueva, "La nueva contraseña debe ser distinta.");
    await u.update(
      {
        passwordHash: await bcrypt.hash(data.nueva, 12),
        sessionVersion: u.sessionVersion + 1,
      },
      { transaction },
    );
    return u;
  });
}
export async function invite(data, by) {
  const correo = email(data.email);
  need(correo.endsWith("@ulima.edu.pe"), "El personal usa @ulima.edu.pe.");
  need(["tecnico", "supervisor"].includes(data.rol), "Rol no válido.");
  need(
    !(await Usuario.findOne({ where: { email: correo } })),
    "Ese correo ya tiene una cuenta.",
    409,
  );
  const token = crypto.randomBytes(32).toString("hex");
  await Invitacion.update(
    { estado: "vencida" },
    {
      where: {
        email: correo,
        estado: "pendiente",
        venceEn: { [Op.lt]: new Date() },
      },
    },
  );
  const inv = await Invitacion.create({
    nombres: text(data.nombres, 1, 60, "nombres"),
    apellidos: text(data.apellidos, 1, 60, "apellidos"),
    email: correo,
    rol: data.rol,
    tokenHash: digest(token),
    invitadoPorId: by,
    estado: "pendiente",
    creadaEn: new Date(),
    venceEn: new Date(Date.now() + 604800000),
  });
  return {
    id: inv.id,
    nombres: inv.nombres,
    apellidos: inv.apellidos,
    email: correo,
    rol: inv.rol,
    token,
    enlace: `/invitacion/${token}`,
    estado: inv.estado,
  };
}
async function invitation(token, transaction) {
  const inv = await Invitacion.findOne({
    where: { tokenHash: digest(token) },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  need(inv, "La invitación no existe.", 404);
  return inv;
}
export async function readInvitation(token) {
  const i = await invitation(token);
  const by = await Usuario.findByPk(i.invitadoPorId);
  return {
    nombres: i.nombres,
    apellidos: i.apellidos,
    email: i.email,
    rol: i.rol,
    estado: i.estado,
    vencida: new Date(i.venceEn) < new Date(),
    venceEn: i.venceEn,
    invitadoPor: by ? `${by.nombres} ${by.apellidos}` : "Infraestructura",
  };
}
export async function acceptInvitation(token, data) {
  password(data.password, data.confirmar);
  return db.transaction(async (transaction) => {
    const inv = await invitation(token, transaction);
    need(
      inv.estado === "pendiente" && new Date(inv.venceEn) > new Date(),
      "Invitación vencida o utilizada.",
      409,
    );
    const ids = [
      ...new Set(
        (Array.isArray(data.especialidades) ? data.especialidades : []).map(
          Number,
        ),
      ),
    ];
    need(
      inv.rol !== "tecnico" || (ids.length >= 1 && ids.length <= 3),
      "Elige entre una y tres especialidades.",
    );
    for (const id of ids)
      need(
        await Categoria.findOne({
          where: { id, parentId: null, activa: true },
          transaction,
        }),
        "Especialidad no válida.",
      );
    const unit = await Unidad.findOne({
      where: { nombre: "Infraestructura y Servicios" },
      transaction,
    });
    const u = await Usuario.create(
      {
        nombres: inv.nombres,
        apellidos: inv.apellidos,
        email: inv.email,
        passwordHash: await bcrypt.hash(data.password, 12),
        telefono: phone(data.telefono),
        unidadId: unit?.id,
        vinculo: "administrativo",
        rol: inv.rol,
        estado: "activo",
        creadoEn: new Date(),
        intentosFallidos: 0,
        sessionVersion: 1,
      },
      { transaction },
    );
    if (inv.rol === "tecnico")
      await Especialidad.bulkCreate(
        ids.map((categoriaId) => ({ usuarioId: u.id, categoriaId })),
        { transaction },
      );
    await inv.update(
      { estado: "aceptada", aceptadaEn: new Date() },
      { transaction },
    );
    return u;
  });
}
export async function rejectInvitation(token) {
  return db.transaction(async (transaction) => {
    const i = await invitation(token, transaction);
    need(
      i.estado === "pendiente" && new Date(i.venceEn) > new Date(),
      "Invitación vencida o utilizada.",
      409,
    );
    await i.update({ estado: "rechazada" }, { transaction });
    return true;
  });
}
// El correo real está fuera de alcance. El operador obtiene el enlace con el script local;
// nunca se devuelve un token de recuperación al solicitante anónimo.
export async function requestRecovery(mail) {
  email(mail);
  return {
    email: mail,
    enlace: null,
    message:
      "Solicitud recibida. Contacta al operador para recibir tu enlace de recuperación.",
  };
}
export async function createRecovery(mail) {
  const u = await Usuario.findOne({ where: { email: email(mail) } });
  need(u, "Usuario no encontrado.", 404);
  const token = crypto.randomBytes(32).toString("hex");
  await db.transaction(async (transaction) => {
    await Recuperacion.update(
      { usadoEn: new Date() },
      { where: { usuarioId: u.id, usadoEn: null }, transaction },
    );
    await Recuperacion.create(
      {
        usuarioId: u.id,
        tokenHash: digest(token),
        creadoEn: new Date(),
        venceEn: new Date(Date.now() + 1800000),
      },
      { transaction },
    );
  });
  return `/recuperar?token=${token}`;
}
async function recovery(token, transaction) {
  const rec = await Recuperacion.findOne({
    where: {
      tokenHash: digest(token),
      usadoEn: null,
      venceEn: { [Op.gt]: new Date() },
    },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  need(rec, "Enlace inválido, utilizado o vencido.", 404);
  return rec;
}
export async function validateRecovery(token) {
  await recovery(token);
  return true;
}
export async function resetPassword(data) {
  password(data.password, data.confirmar);
  return db.transaction(async (transaction) => {
    const rec = await recovery(data.token, transaction);
    const u = await Usuario.findByPk(rec.usuarioId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await u.update(
      {
        passwordHash: await bcrypt.hash(data.password, 12),
        intentosFallidos: 0,
        bloqueadoHasta: null,
        sessionVersion: u.sessionVersion + 1,
      },
      { transaction },
    );
    await Recuperacion.update(
      { usadoEn: new Date() },
      { where: { usuarioId: u.id, usadoEn: null }, transaction },
    );
    return true;
  });
}
