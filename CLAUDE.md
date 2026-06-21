# Project State — AgentPress

## Stack

Default stack. No overrides.

- Monorepo: pnpm workspaces
- API: Fastify + fastify-openapi-glue + TypeScript
- DB: Prisma + MySQL
- SDK: openapi-typescript + openapi-fetch + React Query hooks
- Web: Vite + React + TypeScript + Tailwind

## Phase Completed

Phase 5 — Polish (MVP shipped and verified)

## Modules Built

- [x] Auth (email/password, session cookie)
- [x] Accounts (CRUD + list with pipeline count)
- [x] Pipelines (CRUD + builder with variables, agents, setup)
- [x] Pipeline Variables (inline edit/save/delete)
- [x] Pipeline Agents (UID, prompts, output target, AI assist, reference insert)
- [x] Pipeline Runs (start dry/live, poll for completion, view generated post)
- [x] Run Assets (saved to filesystem under outputs/)
- [x] Destinations (WordPress REST API, application password auth)
- [x] Publish Attempts (tracked per run)
- [x] Prompt Assist (AI-assisted prompt generation)

## MVP Pages

- `AccountsPage.tsx` — list/search/create accounts
- `AccountDetailPage.tsx` — account detail + pipeline list
- `PipelineBuilderPage.tsx` — split-panel builder (Setup/Variables/Agents/Runs)

## Builder Components

- `BuilderSidebar.tsx` — nav (setup, variables, agents, runs)
- `DetailPanel.tsx` — routes selection to the right panel
- `BuilderSetup.tsx` — destination, dry run, schedule, status, Run now
- `BuilderVariable.tsx` — variable key/label/type/default/required editor
- `BuilderAgent.tsx` — agent uid/name/target/format/prompts editor
- `PromptField.tsx` — textarea with insert-reference menu + AI Assist
- `BuilderRun.tsx` — generated post display + assets + publish status

## Deviations from Defaults

- Auth has no User Profile model (owner-only, no username needed)
- Security plugin does not include `profile` relation (not in schema)
- Session cookie only (no JWT)
- Output assets saved to local filesystem (S3 later)
- Scheduling stored as config only (no background scheduler yet)

## Environment Variables Required

- `DATABASE_URL` — MySQL connection string
- `OPENAI_API_KEY` — for text and image generation
- `SESSION_SECRET` — used for AES-256 encryption of WP credentials

## WSL/WAMP Note

On WSL2, MySQL on the Windows host is NOT reachable via `localhost`. Use the
Windows host gateway IP instead (typically `172.19.112.1` — run `ip route show`):

```
DATABASE_URL=mysql://root:@172.19.112.1:3306/agentpress_dev
```

The DB package also needs its own `.env` (copy root `.env` to `packages/db/.env`).
Root user from WSL requires a wildcard host grant:

```sql
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON agentpress_dev.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

## Typecheck Status

- `pnpm typecheck` — CLEAN (all packages pass)
- `apps/server tsconfig.json` has `"noImplicitAny": false` to handle Prisma map callbacks
- SDK hooks use `(response as Response).status` to satisfy openapi-fetch discriminated union typing

## Verified Working

- `POST /auth/login` → session cookie
- `GET /auth/me` → current user
- `GET /api/accounts` → account list with pipeline count
- `GET /api/accounts/:id/pipelines` → pipeline list
- `GET /api/pipelines/:id` → full pipeline with agents + variables
- Web build: 1,617 modules, clean compile

## Batch / Loop System (added post-Phase 5)

Pipelines can be switched to "Batch" mode to run once per research item.

### Schema
- `PipelineLoop` — 1-to-1 with Pipeline; stores loopType, sourceId, cursorMode, variableMap, maxBatchSize
- `PipelineRunBatch` — execution record grouping N PipelineRuns from one batch trigger
- `PipelineRun.batchId` + `PipelineRun.loopIndex` — link individual runs to their batch

### Cursor modes: `all_stored` | `new_since_cursor` | `date_range`
Cursor auto-advances on `new_since_cursor` after successful batch.

### Key invariant
Each batch spawns N normal PipelineRuns (one per item), executed sequentially. Pinning uses `researchItemOverrides: { [source.id]: item.id }` — so `{ziptrader.summary}` resolves to that item without variable remapping. Optional `variableMap` can additionally fill pipeline variables from item fields.

### Safety: max 50 runs per batch (configurable). Preview modal shows estimated AI calls before start.

### API endpoints (tag: batches)
- `GET/PUT/DELETE /api/pipelines/:id/loop`
- `POST /api/pipelines/:id/batch/preview`
- `POST /api/pipelines/:id/batch`
- `GET /api/pipelines/:id/batches`
- `GET /api/pipeline-batches/:id`

### UI
- Pipeline Setup: "Run mode" section — Single vs Batch toggle + source/cursor/date config (LoopConfig.tsx)
- Run button → "Run batch" in batch mode → BatchPreviewModal before confirming
- Runs section shows batch progress bars above individual runs

## Next Steps / Phase 6

- Add OpenAI API key to `.env` and do a live test run
- Verify `pnpm dev` starts both apps and full auth flow works in browser
- Phase 6: Documentation generation
