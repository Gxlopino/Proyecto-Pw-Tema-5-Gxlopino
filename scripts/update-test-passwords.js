// scripts/update-test-passwords.js
import fs from "node:fs/promises";
import bcrypt from "bcryptjs";
import { Op, literal } from "sequelize";
import * as M from "../admin/models/index.js";

const data = JSON.parse(
  await fs.readFile(new URL("../db/seed/seed.json", import.meta.url), "utf8"),
);
const password = "SoloPruebas2026!";
const emails = data.usuarios.map((u) => u.email);

try {
  await M.db.transaction(async (transaction) => {
    const passwordHash = await bcrypt.hash(password, 12);
    const [updated] = await M.Usuario.update(
      {
        passwordHash,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        sessionVersion: literal('COALESCE("session_version", 0) + 1'),
      },
      {
        where: { email: { [Op.in]: emails } },
        transaction,
        returning: false,
      },
    );
    console.log(
      `Contraseñas actualizadas: ${updated} cuentas de prueba. Nueva contraseña: ${password}`,
    );
  });
} catch (e) {
  console.error("No se pudieron actualizar las cuentas de prueba:", e.message);
  process.exitCode = 1;
} finally {
  await M.db.close();
}
