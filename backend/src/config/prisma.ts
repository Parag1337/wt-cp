import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/client/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "./env.js";

export function resolveDatabaseCaPath(rawPath?: string): string {
  const configuredPath = rawPath?.trim();
  if (!configuredPath) {
    return path.resolve(process.cwd(), "aiven-ca.pem");
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

const adapter = new PrismaMariaDb(
  {
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    connectionLimit: 5,
    // Aiven requires TLS with its project CA. Keep certificate verification
    // enabled (never disable it to work around connection errors). Local dev
    // MySQL stays on plain TCP.
    ssl: (() => {
      const useTls =
        env.nodeEnv === "production" ||
        !["localhost", "127.0.0.1"].includes(env.database.host);
      if (!useTls) return undefined;

      const caPath = resolveDatabaseCaPath(process.env.DB_SSL_CA_PATH);
      const ca = fs.readFileSync(caPath, "utf8");
      return { ca, rejectUnauthorized: true };
    })(),
  },
  {
    useTextProtocol: true,
  }
);

export const prisma = new PrismaClient({
  adapter,
  log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
});