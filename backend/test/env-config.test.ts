import test from "node:test";
import assert from "node:assert/strict";

test("DATABASE_URL is accepted without DB_* credentials", async () => {
  const previousDbUrl = process.env.DATABASE_URL;
  const previousDbHost = process.env.DB_HOST;
  const previousDbUser = process.env.DB_USER;
  const previousDbPassword = process.env.DB_PASSWORD;
  const previousDbName = process.env.DB_NAME;

  delete process.env.DB_HOST;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_NAME;
  process.env.DATABASE_URL = "mysql://app:secret@db.example.com:3306/appdb?sslaccept=strict";

  try {
    const mod = await import(`../src/config/env.ts?test=${Date.now()}`);
    assert.equal(mod.databaseUrl, "mysql://app:secret@db.example.com:3306/appdb?sslaccept=strict");
    assert.equal(mod.env.database.host, "localhost");
  } finally {
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDbUrl;
    if (previousDbHost === undefined) delete process.env.DB_HOST; else process.env.DB_HOST = previousDbHost;
    if (previousDbUser === undefined) delete process.env.DB_USER; else process.env.DB_USER = previousDbUser;
    if (previousDbPassword === undefined) delete process.env.DB_PASSWORD; else process.env.DB_PASSWORD = previousDbPassword;
    if (previousDbName === undefined) delete process.env.DB_NAME; else process.env.DB_NAME = previousDbName;
  }
});
