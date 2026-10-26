/**
 * DEMO DATA for local UI testing only (not part of the application).
 *
 * Creates an admin account plus a few orders and inquiries so every admin screen
 * has realistic content. Run against the local dev database only:
 *
 *   cd backend && npx tsx prisma/seed-admin-demo.ts
 *
 * It is idempotent-ish: the admin account is created or upgraded, demo customers
 * use unique emails, and demo orders/inquiries are skipped if they already exist.
 */
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? "owner@jayharikrushi.test";
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? "OwnerDemo#2026";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.customer.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      fullName: "Jay Hari Owner",
      email: ADMIN_EMAIL,
      phone: "9112654020",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`admin: ${admin.email} (id ${admin.id})`);

  const products = await prisma.product.findMany({ orderBy: { id: "asc" }, take: 6 });
  if (products.length === 0) {
    console.log("No products in the database; run the product seed first.");
    return;
  }

  // Give the catalogue varied stock so the inventory filters have something to show.
  const stockPlan = [0, 3, 4, 42, 8, 120];
  for (let i = 0; i < Math.min(products.length, stockPlan.length); i += 1) {
    await prisma.product.update({
      where: { id: products[i].id },
      data: {
        stockQuantity: stockPlan[i],
        lowStockThreshold: 5,
        available: i !== 0,
        price: products[i].price ?? "150.00",
      },
    });
  }

  const customers = [
    { fullName: "Suresh Patil", email: "suresh.patil@demo.test", phone: "9812345601" },
    { fullName: "Meena Deshmukh", email: "meena.deshmukh@demo.test", phone: "9812345602" },
    { fullName: "Rahul Jadhav", email: "rahul.jadhav@demo.test", phone: "9812345603" },
    { fullName: "Anita Kulkarni", email: "anita.kulkarni@demo.test", phone: "9812345604" },
  ];

  const customerIds: number[] = [];
  for (const customer of customers) {
    const existing = await prisma.customer.findUnique({ where: { email: customer.email } });
    const record =
      existing ??
      (await prisma.customer.create({
        data: { ...customer, passwordHash, role: "CUSTOMER" },
      }));
    customerIds.push(record.id);
  }

  const existingDemoOrders = await prisma.order.count({
    where: { customerId: { in: customerIds } },
  });

  if (existingDemoOrders === 0) {
    const statuses = ["pending", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled"];
    const payments: { method: string; status: string; ref: string | null }[] = [
      { method: "razorpay", status: "paid", ref: "pay_DEMO123456" },
      { method: "cod", status: "cod_due", ref: null },
      { method: "upi", status: "pending", ref: "123456789012" },
      { method: "razorpay", status: "failed", ref: null },
      { method: "cod", status: "cod_due", ref: null },
      { method: "razorpay", status: "paid", ref: "pay_DEMO654321" },
      { method: "cod", status: "cod_due", ref: null },
    ];

    for (let i = 0; i < statuses.length; i += 1) {
      const customer = customerIds[i % customerIds.length];
      const itemA = products[i % products.length];
      const itemB = products[(i + 2) % products.length];
      const priceA = 150 + i * 25;
      const priceB = 89.5;
      const qtyA = 2;
      const qtyB = 1;
      const total = priceA * qtyA + priceB * qtyB;

      await prisma.order.create({
        data: {
          customerId: customer,
          status: statuses[i],
          total,
          fullName: customers[i % customers.length].fullName,
          phone: customers[i % customers.length].phone,
          addressLine1: `${12 + i} Main Road, Near Bus Stand`,
          addressLine2: i % 2 === 0 ? "Baradari" : null,
          city: "Khamgaon",
          state: "Maharashtra",
          pincode: "444303",
          paymentMethod: payments[i].method,
          paymentStatus: payments[i].status,
          paymentRef: payments[i].ref,
          createdAt: new Date(Date.now() - i * 26 * 60 * 60 * 1000),
          items: {
            create: [
              { productId: itemA.id, quantity: qtyA, unitPrice: priceA },
              { productId: itemB.id, quantity: qtyB, unitPrice: priceB },
            ],
          },
        },
      });
    }
    console.log(`orders: ${statuses.length} demo orders created`);
  } else {
    console.log(`orders: ${existingDemoOrders} demo orders already present, skipping`);
  }

  const existingInquiries = await prisma.inquiry.count({
    where: { email: { endsWith: "@demo.test" } },
  });
  if (existingInquiries === 0) {
    await prisma.inquiry.createMany({
      data: [
        {
          name: "Ganesh Shinde",
          phone: "9798765432",
          email: "ganesh.shinde@demo.test",
          product: "Urea Fertilizer",
          message: "Is the 50 kg urea bag available this week? I need 10 bags for my cotton field.",
          status: "PENDING",
        },
        {
          name: "Pooja More",
          phone: "9787654321",
          email: "pooja.more@demo.test",
          product: "Hybrid Maize Seeds",
          message: "Which hybrid maize seed do you recommend for the rabi season? Please share prices.",
          status: "READ",
          internalNotes: "Called on Monday, asked to visit the store.",
        },
        {
          name: "Vikas Pawar",
          phone: "9776543210",
          email: "vikas.pawar@demo.test",
          product: null,
          message: "Do you deliver to Buldhana? I want to order fertilizer in bulk.",
          status: "RESOLVED",
          internalNotes: "Explained delivery is limited to Khamgaon.",
        },
        {
          name: "Sunita Bhosale",
          phone: "9765432109",
          email: "sunita.bhosale@demo.test",
          product: "DAP",
          message: "Need 5 bags of DAP. Can I pay by UPI at the store?",
          status: "PENDING",
        },
      ],
    });
    console.log("inquiries: 4 demo inquiries created");
  } else {
    console.log(`inquiries: ${existingInquiries} demo inquiries already present, skipping`);
  }

  console.log(`\nSign in at /admin/login with ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
