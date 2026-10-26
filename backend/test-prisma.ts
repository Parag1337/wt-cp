import { prisma } from "./src/config/prisma.js";

try {
  console.log("testing prisma connection...");
  const start = Date.now();
  const result = await prisma.customer.findFirst({ where: { email: "test@test.com" } });
  console.log("findFirst result:", result, "took", Date.now()-start, "ms");
  await prisma.$disconnect();
  console.log("disconnect ok");
} catch (e) {
  console.error("prisma error:", e);
  try { await prisma.$disconnect(); } catch {}
}
