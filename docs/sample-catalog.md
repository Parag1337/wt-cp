# Sample agricultural catalog (development/demo)

The storefront, product detail pages, cart, checkout, inventory dashboard and admin
product management screens are populated with a realistic Indian agricultural
supplies catalog for development, demonstration and end-to-end testing.

## What is seeded

- 36 demonstration products across the 4 categories supported by the schema:
  `Seeds`, `Fertilizers`, `Pesticides`, `Agricultural Products`.
- Categories cover seeds, fertilizers/soil nutrition, crop protection, farming
  equipment and tools, irrigation accessories and other farming supplies.
- Each product has a name (including pack size), category, description, INR price,
  available flag, stock quantity and low-stock threshold, and an image URL.
- Crop-protection descriptions are neutral and contain no application dosages or
  mixing instructions.

## Seed command

```bash
cd backend
npx tsx src/seed.ts
```

The seed is also wired to Prisma via `prisma.config.ts` (`npm run prisma:seed` if
exposed by your Prisma version).

Environment: requires `DATABASE_URL` (or the `DB_*` variables) pointing at a
**development/demo** database. Never run against production.

## Idempotency

The seed is idempotent: products are matched by name, and existing rows are never
overwritten or deleted. Running it multiple times creates no duplicates and
preserves existing product records and inventory. Updates to seed-owned products
are deliberate (edit the seed array and re-run will NOT overwrite; remove/rename
to change).

## Sample SKUs (documentation only)

The `Product` schema has no SKU column, so SKUs are documented here rather than
stored. They are the stable keys used to identify seed-owned sample products:

- `SEED-MAIZE-HYB-5K`, `SEED-COTTON-HYB-450`, `SEED-SOYBEAN-IMP-10K`,
  `SEED-WHEAT-HD2967-40K`, `SEED-CHICKPEA-10K`, `SEED-VEG-PACK-3`,
  `SEED-PADDY-10K`
- `FERT-NPK-102626-50K`, `FERT-UREA-46-45K`, `FERT-DAP-50K`,
  `FERT-MICRO-1K`, `FERT-ZINC-SULPH-5K`, `FERT-WSF-191919-1K`,
  `FERT-MOP-50K`
- `CP-NEEM-500ML`, `CP-FUNG-MANCO-1K`, `CP-HERB-PRE-1L`,
  `CP-INSECT-IMIDA-250ML`, `CP-BIO-BT-500G`
- `EQUIP-HANDSPRAY-2L`, `EQUIP-KNAPSACK-16L`, `EQUIP-DRIP-KIT-1`,
  `EQUIP-HOSE-50M`, `EQUIP-PRUNER-1`, `EQUIP-SEEDPLANTER-1`
- `IRRIG-EMITTER-50`, `IRRIG-CONN-20`, `IRRIG-PVC-FIT-1`,
  `IRRIG-PUMP-KIT-1`, `IRRIG-DRIPTAPE-1000M`
- `OTHER-PH-KIT-1`, `OTHER-TRAY-104-5`, `OTHER-MULCH-400M`,
  `OTHER-GLOVES-1`, `OTHER-SICKLE-1`, `OTHER-SOILKIT-NPK-1`

## Illustrative data disclaimer

Prices, descriptions and stock levels are illustrative and are NOT verified
current market prices. These products are demonstration data only. No ratings,
review counts, sales counts or testimonials are fabricated. No manufacturer
certifications, government approvals or pesticide registrations are claimed.