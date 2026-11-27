// scripts/model.js
import fs from "node:fs/promises";
import db from "../configs/database.js";
try {
  const [columns] = await db.query(
    `select table_name,column_name,data_type,character_maximum_length,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name <> 'schema_migrations' order by table_name,ordinal_position`,
  );
  const [constraints] = await db.query(
    `select t.relname as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname<>'schema_migrations' order by t.relname,c.conname`,
  );
  const [indexes] = await db.query(
    `select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename<>'schema_migrations' order by tablename,indexname`,
  );
  let out =
    "@startuml db_model\n hide methods\nskinparam linetype ortho\nskinparam shadowing false\n";
  for (const name of [...new Set(columns.map((c) => c.table_name))]) {
    out += `entity "${name}" as ${name} {\n`;
    for (const c of columns.filter((c) => c.table_name === name)) {
      const defs = constraints.filter((x) => x.table_name === name);
      const escaped = c.column_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pk = defs.some(
        (x) => x.contype === "p" && x.definition.includes(c.column_name),
      );
      const fk = defs.some(
        (x) =>
          x.contype === "f" &&
          x.definition.startsWith(`FOREIGN KEY (${c.column_name})`),
      );
      const unique = defs.some(
        (x) =>
          x.contype === "u" && x.definition === `UNIQUE (${c.column_name})`,
      );
      out += `  ${pk ? "* " : ""}${c.column_name} : ${c.data_type}${c.character_maximum_length ? "(" + c.character_maximum_length + ")" : ""} ${[pk ? "PK" : "", fk ? "FK" : "", unique ? "UQ" : "", c.is_nullable === "YES" ? "NULL" : "NOT NULL"].filter(Boolean).join(", ")}\n`;
    }
    out += "}\n";
  }
  for (const c of constraints.filter((x) => x.contype === "f")) {
    const match = c.definition.match(
      /FOREIGN KEY \(([^)]+)\) REFERENCES ([^(]+)\(([^)]+)\)(.*)/,
    );
    if (match) {
      const nullable = columns.some(
        (col) =>
          col.table_name === c.table_name &&
          match[1].split(", ").includes(col.column_name) &&
          col.is_nullable === "YES",
      );
      out += `${c.table_name} }o--${nullable ? "o|" : "||"} ${match[2]} : "${match[1]} → ${match[3]}${match[4]}"\n`;
    }
  }
  out +=
    'note "Fechas: timestamptz, UTC en almacenamiento; America/Lima en UI.\\nCatálogos con códigos únicos: FK natural para estado/prioridad.\\nCategorías: dos niveles; FK compuesta valida subcategoría y padre.\\nRLS sin políticas públicas: acceso exclusivo por Express.\\nSesiones persistidas; tokens almacenados mediante SHA-256.\\nÍndices, CHECK y defaults completos: docs/modelo-validado.json." as reglas\n@enduml\n';
  await fs.writeFile("docs/database (HU-1 a HU-5).puml", out);
  await fs.writeFile(
    "docs/modelo-validado.json",
    JSON.stringify({ columns, constraints, indexes }, null, 2) + "\n",
  );
  console.log("Modelo y restricciones sincronizados con PostgreSQL.");
} finally {
  await db.close();
}
