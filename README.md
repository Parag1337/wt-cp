# Jay Hari Krushi Seva Kendra

Agricultural products website for Jay Hari Krushi Seva Kendra, Khamgaon, Maharashtra.

## Stack

- **Frontend** — Next.js 16 (App Router, Turbopack, Tailwind CSS 4, Poppins + Manrope)
- **Backend** — Node.js + Express 5 (REST API)
- **Database** — MySQL 8 via Prisma ORM (driver adapter)
- **Auth** — bcrypt password hashing + JWT in HttpOnly cookie

## Project Structure

```text
├── src/                 # Next.js frontend
│   ├── app/             # pages: /, /login, /register, /account
│   ├── components/      # landing page + auth components
│   └── lib/             # site data, icons, auth client + context
└── backend/             # Express REST API
    ├── prisma/          # schema + migrations
    └── src/
        ├── controllers/ # authController
        ├── routes/      # authRoutes
        ├── middleware/  # auth + error handling
        ├── services/    # auth service (bcrypt, JWT)
        ├── schemas/     # zod validation
        └── config/      # env + prisma client
```

## Prerequisites

- Node.js 20.19+
- MySQL 8 (server running)

## Database Setup

```bash
# one time: create the database and app user
sudo mysql -e "CREATE DATABASE jay_hari_krushi CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

# configure backend/.env from backend/.env.example (DB credentials, JWT_SECRET)
cd backend
cp .env.example .env   # then edit values

# apply schema migrations
npm run prisma:migrate
```

## Running

```bash
# terminal 1 — API on http://localhost:5000
cd backend
npm install
npm run dev

# terminal 2 — frontend on http://localhost:3000
npm install
npm run dev
```

The frontend proxies `/api/*` requests to the backend (see `next.config.ts`; override with `BACKEND_ORIGIN`).

## Auth API

| Endpoint            | Description                              |
| ------------------- | ---------------------------------------- |
| `POST /api/auth/register` | Create account (sets auth cookie)  |
| `POST /api/auth/login`    | Login (sets HttpOnly cookie)        |
| `GET  /api/auth/me`       | Current customer (JWT protected)    |
| `POST /api/auth/logout`   | Clear session                       |

## Checkout & Payments

- Cart → `/checkout` → delivery address form (name, phone, street, city, state, pincode) + payment method.
- `POST /api/orders` creates the order from the cart and clears the cart. Auth required.
- Payment methods (`src/lib/payment.ts`, `backend/src/services/payment.service.ts`):
  - `cod` — Cash on Delivery, live.
  - `upi` — pay to `STORE_UPI_ID` in `backend/.env`, submit the UPI txn ref, live.
  - `razorpay` — live in test mode. Keys in `backend/.env` (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, gitignored). Flow: `POST /api/orders` creates a Razorpay order → checkout.js popup (`src/app/checkout/checkout-content.tsx`) → `POST /api/orders/:id/verify-payment` checks the HMAC signature **and** re-reads the payment from Razorpay (order, amount, currency, capture) before marking the order `paid`/`confirmed`.
  - If the popup is closed or the payment fails, the order stays `pending` and can be paid again from the order page (`POST /api/orders/:id/retry-payment`).
  - See [`docs/ordering-flow.md`](docs/ordering-flow.md) for the payment contract, duplicate-submission protections and known limitations.

## Product photos

Shop images are real farm photos (Unsplash) stored in `products.image`, plus INR prices. Rerun the seed any time:

```bash
mysql -u root -p jay_hari_krushi < backend/prisma/seed-product-images.sql
```

## Demo catalog seed

The realistic agricultural catalog (36 products) is seeded into the development database with:

```bash
cd backend
npx tsx src/seed.ts
```

The seed is idempotent (products matched by name) and never overwrites or deletes existing rows. Prices, descriptions and stock levels are illustrative only. Do not run against production.

## Test Accounts

Demo rows are created during development:

- `parag@example.com` / `password123`
- `kisan@example.com` / `farmer123`

## Tests

```bash
npm test                 # frontend checkout feedback logic
npm run test:backend     # backend unit + HTTP integration tests (needs MySQL)
```

The backend integration suite creates and removes its own test customers/products in the
configured development database; it performs no Razorpay charges and needs no network for the
signature tests.

## Production Build

```bash
npm run build && npm run start          # frontend
cd backend && npm run build && npm start # API
```

Set `COOKIE_SECURE=true` and `CLIENT_ORIGIN` to your domain in `backend/.env` for HTTPS deployments.
# wt-cp
