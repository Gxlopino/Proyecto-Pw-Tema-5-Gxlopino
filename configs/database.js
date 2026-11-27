// configs/database.js
import "dotenv/config";
import { Sequelize } from "sequelize";
import pg from "pg";
export const connection = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          require: true,
          rejectUnauthorized: !!process.env.DB_SSL_CA_BASE64,
          ...(process.env.DB_SSL_CA_BASE64
            ? {
                ca: Buffer.from(
                  process.env.DB_SSL_CA_BASE64,
                  "base64",
                ).toString("utf8"),
              }
            : {}),
        }
      : false,
};
const sequelize = new Sequelize(
  connection.database,
  connection.user,
  connection.password,
  {
    host: connection.host,
    port: connection.port,
    dialect: "postgres",
    dialectModule: pg,
    logging: false,
    pool: { max: 2, min: 0, acquire: 30000, idle: 1000, evict: 1000 },
    dialectOptions: { ssl: connection.ssl, statement_timeout: 15000 },
    define: { timestamps: false },
  },
);
export default sequelize;
