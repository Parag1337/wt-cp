import { PrismaClient } from "../generated/client/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { databaseUrl, env } from "./env.js";

const adapter = new PrismaMariaDb(databaseUrl, {
  useTextProtocol: true,
});

export const prisma = new PrismaClient({
  adapter,
  log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
});