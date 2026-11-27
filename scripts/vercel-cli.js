// scripts/vercel-cli.js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export function vercelEntry() {
  const cache = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "npm-cache",
    "_npx",
  );
  const dirs = [
    path.resolve("node_modules/vercel"),
    ...String(process.env.PATH || "")
      .split(path.delimiter)
      .map((p) => path.resolve(p, "..", "vercel")),
  ];
  if (fs.existsSync(cache))
    for (const entry of fs.readdirSync(cache))
      dirs.push(path.join(cache, entry, "node_modules", "vercel"));
  for (const dir of dirs) {
    const file = path.join(dir, "package.json");
    if (!fs.existsSync(file)) continue;
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    if (pkg.name !== "vercel") continue;
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.vercel;
    const entry = path.join(dir, bin);
    if (fs.existsSync(entry)) return entry;
  }
  throw new Error(
    "Instala la CLI primero: npm exec --yes --package=vercel -- vercel --version",
  );
}
