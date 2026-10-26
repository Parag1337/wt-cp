import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";
import bcrypt from "bcrypt";

async function main() {
  const { email, password, fullName, phone } = env.adminBootstrap;
  if (!email || !password || !phone) {
    console.log("Admin bootstrap skipped: ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_PHONE must be set.");
    return;
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      console.log("A customer with this email already exists; not promoting automatically.");
      return;
    }
    console.log("Admin already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  await prisma.customer.create({
    data: {
      fullName,
      email,
      phone,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin created: ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
