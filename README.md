# AgentPress

A minimal AI pipeline builder for generating and publishing blog content.

## Setup

1. Copy env: `cp .env.example .env`
2. Edit `DATABASE_URL` and `OPENAI_API_KEY`
3. Run bootstrap: `pnpm bootstrap`

## Dev

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Docs: http://localhost:3001/docs

Default login: `admin@agentpress.local` / `password123`

## Commands

| Command | Description |
|---|---|
| `pnpm bootstrap` | First-run: install, push schema, generate SDK, seed data |
| `pnpm dev` | Run all apps in dev mode |
| `pnpm sdk:generate` | Regenerate types from OpenAPI spec |
| `pnpm db:push` | Push Prisma schema to DB |
| `pnpm db:seed` | Seed development data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm test` | Run all tests |
| `pnpm docs:generate` | Regenerate docs |

## Architecture

```
packages/api-spec/openapi.yaml  ← contract (write first)
packages/db/prisma/schema.prisma ← DB schema
packages/sdk/                   ← generated types + React Query hooks
apps/server/                    ← Fastify API
apps/web/                       ← Vite + React frontend
```

## Pages

- `/` — Accounts list
- `/accounts/:id` — Account detail + pipelines
- `/pipelines/:id` — Pipeline builder (setup, variables, agents, runs)
