# Production configuration checklist

Owner checklist for the first production deployment of Jay Hari Krushi Seva Kendra.
Each item states **how to verify** — an item is "done" only when its verification was
actually observed, not assumed.

## 1. HTTPS and secure cookies

- [ ] Terminate HTTPS at the reverse proxy (nginx/Caddy) with a valid certificate — verify
      by browsing the storefront and admin over `https://` and running
      `curl -I https://<domain>` (expect `200`/`301` to HTTPS, no cert warnings).
- [ ] `COOKIE_SECURE=true` in the backend env — session cookies are then sent with the
      `Secure` flag (`backend/src/config/env.ts` cookie settings). Verify: log in, inspect
      the `Set-Cookie` header shows `Secure` (+ `HttpOnly`).
- [ ] Redirect all HTTP → HTTPS (verify with `curl -I http://<domain>`).
- [ ] If behind exactly one trusted proxy, the backend must trust it so rate limiting and
      logging see real client IPs (`app.set("trust proxy", 1)` in `backend/src/app.ts` —
      **currently not set**; set it when deploying behind a proxy, otherwise
      `req.ip` is the proxy's IP and per-IP rate limits (auth 10 / inquiry 5 per 15 min)
      would aggregate all customers into one bucket).

## 2. Required environment variables (backend/.env, never committed)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL DSN with least-privilege user (§3) |
| `DB_NAME` | database name used by scripts |
| `JWT_SECRET` | long random string; rotate on suspicion |
| `COOKIE_SECURE` | `true` behind HTTPS — cookies are set with the `Secure` flag (`env.cookieSecure`, `sameSite: lax`, 7-day maxAge in `backend/src/utils/cookies.ts`) |
| `CLIENT_ORIGIN` | storefront origin for CORS (default localhost:3000) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | transaction checkout + verification (read via `process.env` in `payment.service.ts`) |
| `RAZORPAY_WEBHOOK_SECRET` | same secret as dashboard webhook (see staging doc §2) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` / `ADMIN_PHONE` | first-admin bootstrap (`env.adminBootstrap`) — disable/remove after the first admin exists |
| `UPLOAD_DIR` | directory for uploaded product images (§4) |
| `AUTH_RATE_LIMIT_MAX` / `INQUIRY_RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | rate-limit budgets (defaults: 10, 5, 15 min) |

Verify with: `npm run build` + a smoke pass of register/login/cart/checkout after starting
with only these set — any unset-but-required var fails loudly at startup, not mid-order.

## 3. Least-privilege database credentials

- [ ] Create a dedicated MySQL user for the app (do **not** run as root):
      `CREATE USER 'jhk_app'@'localhost' IDENTIFIED BY '<random>';`
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON jhk.* TO 'jhk_app'@'localhost';`
      (migrations run by an operator may additionally need `CREATE, ALTER, INDEX, DROP` on
      the schema — or run `prisma migrate deploy` as a separate admin user.)
- [ ] Verify: connect as `jhk_app`, attempt `CREATE DATABASE` → must fail.
- [ ] MySQL reachable only from localhost/VPN, not the public internet (verify with an
      external `mysql -h <host>` connection attempt failing).

## 4. Persistent upload storage

- [ ] `UPLOAD_DIR` points at a persistent volume that survives redeploys (not the app build
      directory). The backend serves uploads via `express.static(env.storage.staticRoot)`
      (`backend/src/app.ts`), so the volume must remain mounted at the same path across deploys.
- [ ] Verify: upload a product image in the admin panel, redeploy/restart, confirm the image
      still renders on the storefront.
- [ ] Backups include `UPLOAD_DIR` (or move to object storage later — out of current scope).

## 5. Database backup and restore

- [ ] Nightly dump with consistent snapshot:
      `mysqldump --single-transaction --routines --triggers -u <backup_user> -p jhk > jhk-$(date +%F).sql`
      (`--single-transaction` avoids locking live InnoDB tables).
- [ ] Test the restore path **into a disposable database** at least once:
      `mysql -u root -p -e "CREATE DATABASE jhk_restore;"`
      `mysql -u root -p jhk_restore < jhk-2026-XX-XX.sql`
      then verify product/order counts match, and that `prisma migrate status` reports
      "up to date" against the restored schema.
- [ ] Never repair drift with `prisma migrate dev` on a shared/production DB (it can prompt
      destructive resets). Use `prisma migrate deploy` only; investigate drift offline.
- [ ] Keep dumps off the DB host with retention appropriate to the business.

## 6. lint failures — current state and ownership

`npm run lint` (repo root): **3 errors, 17 warnings** as of 2026-10-27. All three errors are
pre-existing `react-hooks/set-state-in-effect` violations, unchanged by the release-blocker
work:

| File | Error | Owner |
| --- | --- | --- |
| `src/components/product-detail.tsx` (24) | setState synchronously in effect | product page owner |
| `src/components/shop-catalog.tsx` (32) | setState synchronously in effect | catalog owner |
| `src/components/shop-product-detail.tsx` (29, pre-existing — not the B-3 gating lines) | setState synchronously in effect | shop detail owner |

Nothing in the release-blocker fixes weakened lint or tests: backend `npm test` = 79/79,
frontend suite 25/25, root `npm run build` + `npx tsc --noEmit` clean. CI should treat these
3 errors as a **fail** gate for any new code but may carry a temporary waiver for the named
files until their owner refactors the data-loading patterns.

## 7. Pre-launch verification pass

- [ ] `npx prisma migrate deploy` against a fresh production DB — all 9 migration rows
      finished (the B-1-corrected `20261027000000` applies cleanly; see
      `docs/ordering-flow.md` migration notes).
- [ ] Seed/bootstrap: first admin account created via the bootstrap flow
      (`backend/src/config/env.ts` `adminBootstrap`), then the bootstrap mechanism disabled.
- [ ] Storefront smoke: browse, add-to-cart, checkout COD, checkout Razorpay test-style
      (staging), zero-stock item shows "Out of stock" and refuses add.
- [ ] Webhook configured per `docs/staging-verification-razorpay-webhook.md` (staging sign-off first).
