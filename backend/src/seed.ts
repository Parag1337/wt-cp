import { prisma } from "./config/prisma.js";

/**
 * Demonstration catalog seed for Jay Hari Krushi Seva Kendra.
 *
 * Populates a realistic Indian agricultural supplies catalog (seeds, fertilizers,
 * crop protection, equipment/tools, irrigation accessories and other farming
 * supplies) into the development/demo database.
 *
 * Properties:
 *  - Development/demo only. Never run against production.
 *  - Idempotent: products are matched by name; existing rows are never overwritten
 *    or deleted, so running the seed repeatedly does not duplicate products.
 *  - Stable-ish unique key: product name (the schema has no SKU column; SKU is
 *    therefore documented per product below rather than stored).
 *  - Preserves existing product records and inventory.
 *
 * Command:
 *   cd backend && npx tsx src/seed.ts
 *
 * Environment: requires DATABASE_URL (or DB_* vars) pointing at a development
 * database, e.g. the local `jay_hari_krushi` instance.
 *
 * Prices, descriptions and stock levels are illustrative only and are NOT
 * verified current market prices. Crop-protection descriptions are neutral and
 * contain no application dosages or mixing instructions.
 */

type SeedProduct = {
  name: string;
  sku: string; // documentation only; not stored (schema has no SKU column)
  category: string;
  description: string;
  image: string | null;
  price: number | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
};

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;
const P = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;

const products: SeedProduct[] = [
  // Seeds
  { name: "Hybrid Maize Seeds — 5 kg", sku: "SEED-MAIZE-HYB-5K", category: "Seeds", description: "Hybrid maize seed suited to kharif and rabi seasons. Selected for good germination and uniform crop stand. For agricultural use.", image: U("photo-1560493676-04071c5f467b"), price: 1450.0, available: true, stockQuantity: 35, lowStockThreshold: 8 },
  { name: "Hybrid Cotton Seeds — 450 g", sku: "SEED-COTTON-HYB-450", category: "Seeds", description: "Hybrid cotton seed for lint production. Chosen for germination quality and crop vigour. For agricultural use.", image: U("photo-1594498653385-d5172c532c00"), price: 2200.0, available: true, stockQuantity: 18, lowStockThreshold: 5 },
  { name: "Soybean Seeds (Improved) — 10 kg", sku: "SEED-SOYBEAN-IMP-10K", category: "Seeds", description: "Improved soybean seed adapted to local growing conditions. Selected for yield potential and disease tolerance. For agricultural use.", image: U("photo-1518977676601-b53f82aba655"), price: 1180.0, available: true, stockQuantity: 40, lowStockThreshold: 8 },
  { name: "Wheat Seeds (HD-2967) — 40 kg", sku: "SEED-WHEAT-HD2967-40K", category: "Seeds", description: "Wheat seed of a well-established variety suitable for the region. Chosen for rust tolerance and grain quality. For agricultural use.", image: U("photo-1574323347407-f5e1ad6d020b"), price: 1680.0, available: true, stockQuantity: 25, lowStockThreshold: 6 },
  { name: "Chickpea (Gram) Seeds — 10 kg", sku: "SEED-CHICKPEA-10K", category: "Seeds", description: "Chickpea seed for rabi cultivation. Selected for germination and pod filling. For agricultural use.", image: U("photo-1560806887-1e4cd0b6cbd6"), price: 1320.0, available: true, stockQuantity: 30, lowStockThreshold: 6 },
  { name: "Vegetable Seed Pack — Tomato / Brinjal / Chilli", sku: "SEED-VEG-PACK-3", category: "Seeds", description: "Mixed vegetable seed pack containing tomato, brinjal and chilli. Suitable for kitchen gardens and small plots. For agricultural use.", image: U("photo-1560493676-04071c5f467b"), price: 145.0, available: true, stockQuantity: 60, lowStockThreshold: 10 },
  { name: "Paddy (Rice) Seeds — 10 kg", sku: "SEED-PADDY-10K", category: "Seeds", description: "Paddy seed suitable for the local season. Selected for germination and tillering. For agricultural use.", image: U("photo-1574323347407-f5e1ad6d020b"), price: 980.0, available: true, stockQuantity: 22, lowStockThreshold: 5 },

  // Fertilizers and soil nutrition
  { name: "NPK 10:26:26 Fertilizer — 50 kg", sku: "FERT-NPK-102626-50K", category: "Fertilizers", description: "Phosphorus-rich NPK fertilizer for root development and flowering. Suitable for a range of crops and soil conditions.", image: U("photo-1595855759920-86582396756a"), price: 1320.0, available: true, stockQuantity: 45, lowStockThreshold: 8 },
  { name: "Urea (46% N) — 45 kg Bag", sku: "FERT-UREA-46-45K", category: "Fertilizers", description: "Urea fertilizer with 46% nitrogen content. Used to support vegetative growth in crops. For agricultural use.", image: U("photo-1605000797499-95a51c5269ae"), price: 266.0, available: true, stockQuantity: 80, lowStockThreshold: 10 },
  { name: "DAP Fertilizer — 50 kg Bag", sku: "FERT-DAP-50K", category: "Fertilizers", description: "Di-ammonium phosphate fertilizer providing phosphorus and nitrogen for strong root development. For agricultural use.", image: U("photo-1589923188900-85dae523342b"), price: 1350.0, available: true, stockQuantity: 60, lowStockThreshold: 8 },
  { name: "Micronutrient Mixture — 1 kg", sku: "FERT-MICRO-1K", category: "Fertilizers", description: "Micronutrient mixture for soil and foliar application to address trace-element deficiencies. For agricultural use.", image: U("photo-1570042225831-d98fa7577f1e"), price: 320.0, available: true, stockQuantity: 40, lowStockThreshold: 8 },
  { name: "Zinc Sulphate — 5 kg", sku: "FERT-ZINC-SULPH-5K", category: "Fertilizers", description: "Zinc sulphate for correcting zinc deficiency in soils and crops. For agricultural use.", image: U("photo-1570042225831-d98fa7577f1e"), price: 680.0, available: true, stockQuantity: 25, lowStockThreshold: 5 },
  { name: "Water-Soluble Fertilizer (19:19:19) — 1 kg", sku: "FERT-WSF-191919-1K", category: "Fertilizers", description: "Water-soluble NPK fertilizer for fertigation and foliar feeding. Dissolves readily for drip and sprinkler systems. For agricultural use.", image: U("photo-1595855759920-86582396756a"), price: 490.0, available: true, stockQuantity: 35, lowStockThreshold: 6 },
  { name: "MOP (Potash) Fertilizer — 50 kg", sku: "FERT-MOP-50K", category: "Fertilizers", description: "Muriate of potash fertilizer providing potassium for crop quality, disease resistance and water regulation. For agricultural use.", image: U("photo-1627920769842-6887c6df05ca"), price: 950.0, available: true, stockQuantity: 20, lowStockThreshold: 5 },

  // Crop protection
  { name: "Neem-Based Crop Protection Concentrate — 500 ml", sku: "CP-NEEM-500ML", category: "Pesticides", description: "Neem-based crop protection concentrate for general crop care. Use as directed on the product label. For agricultural use.", image: U("photo-1586771107445-d3ca888129ff"), price: 340.0, available: true, stockQuantity: 45, lowStockThreshold: 8 },
  { name: "Fungicide (Mancozeb 75% WP) — 1 kg", sku: "CP-FUNG-MANCO-1K", category: "Pesticides", description: "Broad-spectrum fungicide for fungal disease management in crops. Use as directed on the product label. For agricultural use.", image: U("photo-1416879595882-3373a0480b5b"), price: 560.0, available: true, stockQuantity: 28, lowStockThreshold: 6 },
  { name: "Herbicide (Pre-emergence) — 1 L", sku: "CP-HERB-PRE-1L", category: "Pesticides", description: "Pre-emergence herbicide for weed control before crop emergence. Use as directed on the product label. For agricultural use.", image: U("photo-1586771107445-d3ca888129ff"), price: 890.0, available: true, stockQuantity: 15, lowStockThreshold: 5 },
  { name: "Insecticide (Imidacloprid 17.8 SL) — 250 ml", sku: "CP-INSECT-IMIDA-250ML", category: "Pesticides", description: "Systemic insecticide for sucking pests. Use as directed on the product label. For agricultural use.", image: U("photo-1592982537447-7440770cbfc9"), price: 420.0, available: true, stockQuantity: 32, lowStockThreshold: 6 },
  { name: "Bio-Insecticide (Bacillus thuringiensis) — 500 g", sku: "CP-BIO-BT-500G", category: "Pesticides", description: "Biological insecticide based on Bacillus thuringiensis for caterpillar control. Use as directed on the product label. For agricultural use.", image: U("photo-1592982537447-7440770cbfc9"), price: 610.0, available: true, stockQuantity: 20, lowStockThreshold: 5 },

  // Farming equipment and tools
  { name: "Hand Sprayer (2 L) — 1 piece", sku: "EQUIP-HANDSPRAY-2L", category: "Agricultural Products", description: "Manual hand sprayer with 2-litre tank for applying liquid inputs. Adjustable nozzle. For agricultural use.", image: U("photo-1615811361523-6bd03d7748e7"), price: 420.0, available: true, stockQuantity: 25, lowStockThreshold: 5 },
  { name: "Knapsack Sprayer (16 L) — 1 piece", sku: "EQUIP-KNAPSACK-16L", category: "Agricultural Products", description: "Backpack knapsack sprayer with 16-litre tank for field spraying. Adjustable pressure and nozzle. For agricultural use.", image: U("photo-1615811361523-6bd03d7748e7"), price: 1850.0, available: true, stockQuantity: 12, lowStockThreshold: 3 },
  { name: "Drip Irrigation Starter Kit — 1 set", sku: "EQUIP-DRIP-KIT-1", category: "Agricultural Products", description: "Drip irrigation starter kit including laterals, emitters and connectors for a small plot. For agricultural use.", image: U("photo-1625246333195-78d9c38ad449"), price: 1280.0, available: true, stockQuantity: 18, lowStockThreshold: 4 },
  { name: "Garden Hose (50 m) — 1 piece", sku: "EQUIP-HOSE-50M", category: "Agricultural Products", description: "Flexible garden hose, 50 metres, for irrigation and general water transfer. For agricultural use.", image: P("jh-garden-hose"), price: 1650.0, available: true, stockQuantity: 14, lowStockThreshold: 4 },
  { name: "Pruning Shears — 1 piece", sku: "EQUIP-PRUNER-1", category: "Agricultural Products", description: "Hand pruning shears with steel blades for trimming and harvesting. For agricultural use.", image: P("jh-pruning-shears"), price: 380.0, available: true, stockQuantity: 30, lowStockThreshold: 6 },
  { name: "Manual Seed Planter — 1 piece", sku: "EQUIP-SEEDPLANTER-1", category: "Agricultural Products", description: "Manual single-row seed planter for small holdings. Simple, low-maintenance design. For agricultural use.", image: P("jh-seed-planter"), price: 2450.0, available: true, stockQuantity: 8, lowStockThreshold: 3 },

  // Irrigation and accessories
  { name: "Drip Emitters (Pack of 50)", sku: "IRRIG-EMITTER-50", category: "Agricultural Products", description: "Drip emitters, pack of 50, for precise water delivery to plants. For agricultural use.", image: U("photo-1625246333195-78d9c38ad449"), price: 360.0, available: true, stockQuantity: 40, lowStockThreshold: 8 },
  { name: "Irrigation Connectors (Pack of 20)", sku: "IRRIG-CONN-20", category: "Agricultural Products", description: "Irrigation connectors, pack of 20, for joining drip laterals and fittings. For agricultural use.", image: P("jh-irrigation-connectors"), price: 290.0, available: true, stockQuantity: 50, lowStockThreshold: 8 },
  { name: "PVC Irrigation Fittings Set — 1 set", sku: "IRRIG-PVC-FIT-1", category: "Agricultural Products", description: "PVC irrigation fittings set for assembling and repairing irrigation lines. For agricultural use.", image: P("jh-pvc-fittings"), price: 540.0, available: true, stockQuantity: 22, lowStockThreshold: 5 },
  { name: "Water Pump Accessories Kit — 1 set", sku: "IRRIG-PUMP-KIT-1", category: "Agricultural Products", description: "Water pump accessories kit including fittings and connectors for small pump setups. For agricultural use.", image: P("jh-pump-accessories"), price: 1180.0, available: true, stockQuantity: 10, lowStockThreshold: 3 },

  // Other farming supplies
  { name: "Soil pH Testing Kit — 1 piece", sku: "OTHER-PH-KIT-1", category: "Agricultural Products", description: "Soil pH testing kit for quick field assessment of soil acidity/alkalinity. For agricultural use.", image: P("jh-soil-ph-kit"), price: 720.0, available: true, stockQuantity: 16, lowStockThreshold: 4 },
  { name: "Seedling Trays (104-cell, Pack of 5)", sku: "OTHER-TRAY-104-5", category: "Agricultural Products", description: "Seedling trays, 104-cell, pack of 5, for nursery raising. For agricultural use.", image: P("jh-seedling-trays"), price: 480.0, available: true, stockQuantity: 35, lowStockThreshold: 6 },
  { name: "Mulching Film (Black, 500 gauge, 400 m) — 1 roll", sku: "OTHER-MULCH-400M", category: "Agricultural Products", description: "Black agricultural mulch film for weed control, moisture retention and soil temperature regulation. For agricultural use.", image: U("photo-1500382017468-9049fed747ef"), price: 3200.0, available: true, stockQuantity: 6, lowStockThreshold: 2 },
  { name: "Protective Farming Gloves (Pair)", sku: "OTHER-GLOVES-1", category: "Agricultural Products", description: "Protective farming gloves for handling tools and inputs. For agricultural use.", image: P("jh-farming-gloves"), price: 180.0, available: true, stockQuantity: 70, lowStockThreshold: 10 },
  { name: "Harvesting Tool (Sickle) — 1 piece", sku: "OTHER-SICKLE-1", category: "Agricultural Products", description: "Traditional sickle for harvesting and cutting. For agricultural use.", image: P("jh-sickle"), price: 260.0, available: true, stockQuantity: 24, lowStockThreshold: 5 },

  // A couple of out-of-stock demonstration products
  { name: "Drip Tape (Thin Wall, 1000 m) — 1 roll", sku: "IRRIG-DRIPTAPE-1000M", category: "Agricultural Products", description: "Thin-wall drip tape, 1000 metres, for row-crop irrigation. For agricultural use.", image: U("photo-1625246333195-78d9c38ad449"), price: 2100.0, available: false, stockQuantity: 0, lowStockThreshold: 3 },
  { name: "Soil Testing Kit (NPK) — 1 piece", sku: "OTHER-SOILKIT-NPK-1", category: "Agricultural Products", description: "Soil testing kit for NPK assessment in the field. For agricultural use.", image: P("jh-soil-npk-kit"), price: 980.0, available: false, stockQuantity: 0, lowStockThreshold: 3 },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (existing) {
      skipped += 1;
      console.log(`skip (exists): ${product.name} (id ${existing.id})`);
      continue;
    }
    const createdProduct = await prisma.product.create({
      data: {
        name: product.name,
        category: product.category,
        description: product.description,
        image: product.image,
        price: product.price,
        available: product.available,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
      },
    });
    created += 1;
    console.log(`created: ${product.name} (id ${createdProduct.id}) — sku ${product.sku}`);
  }
  console.log(`\nSeeded ${created} new products, skipped ${skipped} existing. Total catalog products: ${products.length}.`);
  console.log("NOTE: These are demonstration products. Prices, descriptions and stock levels are illustrative.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });