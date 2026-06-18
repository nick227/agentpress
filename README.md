# AgentPress

A minimal AI pipeline builder. Create accounts, define agent workflows, generate blog content with GPT-4o, and publish to WordPress — all from a single split-panel UI.

## What it does

- **Accounts** hold one or more pipelines
- **Pipelines** chain agents together: each agent has a system prompt, user prompt, and an output target (`title`, `body`, `excerpt`, `thumbnail_prompt`)
- **Variables** are defined once per pipeline and interpolated into prompts at run time as `{variable_key}`
- **Agents** can reference prior agent output in their prompts as `{agents.uid.output}`
- **Runs** execute agents sequentially via the OpenAI API and save output assets locally
- **Destinations** publish to WordPress via the REST API using Application Passwords

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| API server | Fastify + fastify-openapi-glue + TypeScript |
| Database | Prisma + MySQL |
| SDK | openapi-typescript + openapi-fetch + TanStack Query |
| Web | Vite + React + TypeScript + Tailwind CSS |
| AI | OpenAI (GPT-4o text, DALL-E 3 images) |

The OpenAPI spec (`packages/api-spec/openapi.yaml`) is the single source of truth for the API contract. The SDK types are generated from it — never hand-written.

## Project layout

```
apps/
  server/          Fastify API server
  web/             Vite + React frontend
packages/
  api-spec/        openapi.yaml
  db/              Prisma schema + seed
  sdk/             Generated types + React Query hooks
scripts/           Code generation helpers
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8 (local or remote)

### 1. Clone and install

```bash
git clone https://github.com/your-org/agentpress.git
cd agentpress
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL=mysql://root:@localhost:3306/agentpress_dev
SESSION_SECRET=<random 64-char hex string>
OPENAI_API_KEY=sk-...
```

> **WSL2 + WAMP**: MySQL on the Windows host is not reachable via `localhost` from WSL. Use the Windows gateway IP (`ip route show | grep default`) instead:
> ```
> DATABASE_URL=mysql://root:@172.x.x.1:3306/agentpress_dev
> ```
> Grant WSL access first:
> ```sql
> CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
> GRANT ALL PRIVILEGES ON agentpress_dev.* TO 'root'@'%';
> FLUSH PRIVILEGES;
> ```

### 3. Bootstrap

```bash
pnpm db:push      # push Prisma schema to MySQL
pnpm db:seed      # seed demo account + pipeline
pnpm dev          # start API on :3001 and web on :5173
```

Open [http://localhost:5173](http://localhost:5173) and log in with `admin@agentpress.local` / `password123`.

## Development scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start API + web in parallel |
| `pnpm build` | Production build for all packages |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm sdk:generate` | Regenerate SDK types from `openapi.yaml` |
| `pnpm db:push` | Sync Prisma schema to the database |
| `pnpm db:seed` | Reset and reseed demo data |
| `pnpm db:studio` | Open Prisma Studio |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `SESSION_SECRET` | Yes | AES-256 key for encrypting WordPress credentials at rest |
| `OPENAI_API_KEY` | Yes | Used for text and image generation |
| `PORT` | No | API server port (default `3001`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default `http://localhost:5173`) |
| `VITE_API_URL` | No | API base URL injected into the browser build (default `http://localhost:3001`) |
| `OPENAI_TEXT_MODEL` | No | Chat completion model (default `gpt-4o`) |
| `OPENAI_IMAGE_MODEL` | No | Image generation model (default `dall-e-3`) |
| `OUTPUT_ROOT` | No | Directory for saving run assets (default `./outputs`) |

## Adding a WordPress destination

1. In WordPress admin go to **Users → Profile → Application Passwords** and generate a password.
2. In AgentPress open a pipeline, go to **Setup → Destinations**, click **Add WordPress destination**.
3. Enter the site URL, your WordPress username, and the application password.
4. Click the destination row to mark it active for that pipeline.

Credentials are encrypted at rest with AES-256-CBC using `SESSION_SECRET`.

## How pipeline runs work

Runs are **asynchronous** — the API returns immediately with a `running` status and a run ID. The frontend polls every 2 seconds until the status is `completed` or `failed`.

Agents execute in `sortOrder` sequence. Each agent's output is stored and made available to later agents via `{agents.uid.output}` references in prompts.

## URL structure

| URL | Page |
|---|---|
| `/` | Accounts list |
| `/accounts/:slug` | Account detail + pipelines |
| `/accounts/:slug/pipelines/:slug` | Pipeline builder |

## License

MIT
