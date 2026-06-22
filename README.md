# Home Maintain Backend

Backend foundation for the FixItHome admin, customer, and provider applications.

This project currently contains only the Express foundation and Prisma ORM/database schema. Business APIs will be implemented in a later phase.

## Frontend applications analyzed

The schema was derived from read-only analysis of these sibling applications:

- `home-maintain-dashboard`: admin routes, central mock types/data, verification review, provider/customer controls, service moderation, bookings, platform categories and areas, bilingual notifications, audit history, internal notes, profile, and security screens.
- `home-maintain-service-app`: customer routes, app context, service/vendor data, saved-address fields, booking steps and snapshots, timelines, reviews, notification state, profile/security fields, and EN/KM language state.
- `home-maintain-service-provider-app`: provider context, registration and verification steps, business/location/document fields, service form pricing and availability fields, booking request transitions, reviews, notifications, profile/security, and EN/KM language state.

## Tech stack

- Node.js, Express 5, and TypeScript
- Prisma ORM with PostgreSQL
- dotenv and Zod environment validation
- CORS, Helmet, and Morgan middleware
- tsx for development and database seeding

## Folder structure

```text
home-maintain-backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── config/env.ts
│   ├── db/prisma.ts
│   ├── modules/README.md
│   ├── scripts/README.md
│   ├── types/index.ts
│   ├── app.ts
│   └── server.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Environment setup

1. Copy `.env.example` to `.env`.
2. Replace the placeholder PostgreSQL credentials in `DATABASE_URL`.
3. Keep `CLIENT_ORIGINS` as a comma-separated list of allowed frontend origins.

No real credentials belong in source control.

## Commands

```bash
npm install
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Additional commands:

```bash
npm run typecheck
npm run build
npm start
npm run prisma:studio
```

`prisma:migrate`, `prisma:seed`, and Prisma Studio require a reachable PostgreSQL database. Prisma generation, schema validation, typechecking, and compilation do not.

## Health endpoint

`GET /health`

```json
{
  "status": "ok",
  "service": "home-maintain-backend"
}
```

All other paths currently return `404 Not Found`.

## Domain design

- Users have role-specific one-to-one admin, customer, or provider profiles plus preferences and account sessions.
- Categories and service areas are admin-managed platform taxonomy.
- Providers own business profiles, verification submissions, and service listings.
- Verification submissions preserve documents, checklist items, decisions, and timeline events.
- Service listings belong to one category, cover many service areas through `ServiceListingArea`, and preserve moderation history.
- Bookings connect one customer, provider, and service listing while preserving schedule, address snapshots, issues, timeline items, and status history.
- Reviews connect customers, providers, and services and may identify their completed booking.
- Notifications are mutable operational alerts owned by a user.
- Audit logs are administrative history and use generic module, record, and route references. Application code should treat them as append-only.
- Internal admin notes are private admin-workspace records and use the same generic reference strategy.
- Internal CUID primary keys are separate from stable frontend-facing `publicId` values.
- Bilingual content is stored where the current interfaces contain separate English and Khmer values; user language is stored in `UserPreference`.

## Seed data

The rerunnable seed uses stable `publicId` values and upserts for categories, service areas, one admin, seven providers, five customers, six services, six bookings, status history covering all seven booking statuses, verification records, moderation history, booking issues, notifications, audit logs, an internal note, and a review.

Seed users contain `NOT_A_REAL_HASH__SEED_ONLY__AUTH_NOT_IMPLEMENTED`. It is deliberately not a usable password hash. Authentication APIs are not implemented.

## Current scope

Implemented:

- Typed environment loading and validation
- Express middleware and lifecycle foundation
- `GET /health`, 404 handling, and global error handling
- Development-safe Prisma singleton
- Complete PostgreSQL Prisma schema for the represented frontend domain
- Rerunnable demo seed structure

Intentionally not implemented:

- Authentication or authorization APIs
- Business CRUD or workflow APIs
- Frontend integration
- Payments, wallet, checkout, payroll, staff management, inventory, or technician assignment
- Any business route other than `GET /health`

## Next phase recommendation

Confirm the schema against product requirements, create the initial migration against a development PostgreSQL instance, and then implement authentication/authorization boundaries before adding domain APIs in vertical slices. A practical first business slice is read-only taxonomy followed by provider verification, with tests and audit-writing rules defined alongside each slice.
