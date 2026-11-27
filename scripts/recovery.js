// scripts/recovery.js
import { createInterface } from "node:readline/promises";
import { createRecovery } from "../website/services/accounts.js";
import db from "../configs/database.js";
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  const mail = await rl.question(
    "Correo de la cuenta (verifica la identidad del solicitante): ",
  );
  const link = await createRecovery(mail);
  console.log("Enlace temporal privado; entrégalo solo al titular:", link);
} catch (e) {
  console.error(e.status ? e.message : "No se pudo generar el enlace.");
  process.exitCode = 1;
} finally {
  rl.close();
  await db.close();
}
