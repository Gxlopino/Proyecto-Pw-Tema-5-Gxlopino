// scripts/vercel-env.js
import { vercelEntry } from "./vercel-cli.js";
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const values = {
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: "6543",
  DB_SSL: "true",
  SESSION_SECRET: randomBytes(48).toString("hex"),
  NODE_ENV: "production",
  ...(process.env.DB_SSL_CA_BASE64
    ? { DB_SSL_CA_BASE64: process.env.DB_SSL_CA_BASE64 }
    : {}),
};
for (const [key, value] of Object.entries(values)) {
  if (!value) throw new Error(`Falta ${key} en .env.`);
  const result = spawnSync(
    process.execPath,
    [
      vercelEntry(),
      "env",
      "add",
      key,
      "--environment",
      "production,preview",
      "--sensitive",
      "--force",
      "--yes",
      "--scope",
      "team_WXL6qKsjPwAepNetjndewhi8",
    ],
    { input: value, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    console.error(
      `No se pudo configurar ${key}; salida omitida para proteger secretos.`,
    );
    process.exit(1);
  }
  console.log(`${key}: configurada de forma secreta en production y preview.`);
}
