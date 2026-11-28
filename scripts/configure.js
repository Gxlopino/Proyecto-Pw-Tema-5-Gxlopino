// scripts/configure.js
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const encode = (v) =>
  encodeURIComponent(v).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
const quote = (v) => {
  if (!v.includes("'")) return "'" + v + "'";
  if (!v.includes("`")) return "`" + v + "`";
  throw new Error(
    "Para valores con comillas simples y backticks, edita .env localmente.",
  );
};
try {
  let previous = {};
  try {
    previous = parse(await readFile(".env"));
    if (!process.argv.includes("--update"))
      throw new Error(
        "Ya existe .env. Para actualizarlo: npm run configure -- --update",
      );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const defaultHost = previous.DB_HOST || "";
  const host =
    (await rl.question(`Host Session pooler [${defaultHost}]: `)).trim() ||
    defaultHost;
  if (!/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host))
    throw new Error("Host no válido.");
  const user = (await rl.question("Usuario del Session pooler (postgres.REFERENCIA): ")).trim();
  if (!/^postgres\.[a-z0-9]+$/.test(user)) throw new Error("Usuario del pooler no válido.");
  rl.close();
  const stdin = process.stdin;
  if (!stdin.isTTY) throw new Error("Usa una terminal interactiva.");
  process.stdout.write("Contraseña original de PostgreSQL (oculta): ");
  stdin.setRawMode(true);
  stdin.resume();
  const pass = await new Promise((resolve) => {
    let value = "";
    const listener = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\r" || c === "\n") {
          stdin.off("data", listener);
          stdin.setRawMode(false);
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", listener);
  });
  if (!pass || /[\r\n]/.test(pass))
    throw new Error("Contraseña vacía o con saltos de línea.");
  const values = {
    ...previous,
    DB: `postgresql://${encode(user)}:${encode(pass)}@${host}:5432/postgres?sslmode=require`,
    DB_NAME: "postgres",
    DB_USER: user,
    DB_PASS: pass,
    DB_HOST: host,
    DB_PORT: "5432",
    DB_SSL: "true",
    SESSION_SECRET: previous.SESSION_SECRET || randomBytes(48).toString("hex"),
    PORT: previous.PORT || "3000",
    NODE_ENV: previous.NODE_ENV || "development",
  };
  const content =
    "# Configuración local; no versionar este archivo.\n" +
    Object.entries(values)
      .map(([key, value]) => `${key}=${quote(String(value))}`)
      .join("\n") +
    "\n";
  await writeFile(".env", content, { mode: 0o600 });
  console.log(
    "\n.env guardado sin mostrar secretos. Reinicia el servidor y actualiza Vercel y Antares.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
  process.stdin.pause();
}
