import { DataTypes as D } from "sequelize";
import db from "../configs/database.js";
const snake = (s) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
export const make = (table, fields) =>
  db.define(
    table,
    Object.fromEntries(
      Object.entries({
        id: { type: D.INTEGER, primaryKey: true, autoIncrement: true },
        ...fields,
      }).map(([key, value]) => [
        key,
        { ...(value.type ? value : { type: value }), field: snake(key) },
      ]),
    ),
    { tableName: table, timestamps: false },
  );
export const S = D.STRING,
  T = D.DATE,
  I = D.INTEGER,
  B = D.BOOLEAN;

export { D, db };
