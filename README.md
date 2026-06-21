# AgentPress

AgentPress is an account-based AI pipeline builder for turning stored research feeds into generated content. Create accounts, connect research sources, define multi-agent workflows, interpolate feed summaries into prompts, generate posts with OpenAI, save assets locally, and optionally publish to WordPress.

## What It Does

- **Accounts** own pipelines, destinations, research sources, and pipeline runs.
- **Research feeds** collect YouTube transcripts, Reddit daily digests, and RSS/Atom articles.
- **Research caching** protects remote providers with a one-hour cache around all feed/source fetches, including failed remote responses.
- **Pipelines** chain ordered agents together. Each agent has a system prompt, user prompt, and output use.
- **Variables** interpolate into prompts at run time as `{variable_key}`.
- **Agent outputs** are always saved and can be referenced by later agents as `{agents.uid.output}`.
- **Research references** interpolate stored feed summaries into prompts using compact source slugs such as `{ziptrader.summary}`.
- **Runs** execute asynchronously, save generated assets locally, and keep the resolved variables used by the run.
- **Destinations** publish completed content to WordPress through the REST API using Application Passwords.

## Research Feeds And Pipeline References

Research sources are internal data feeds. Remote provider calls happen only when a source is checked or created/updated. Pipeline runs do **not** call Reddit, YouTube, RSS feeds, or other remote providers directly; they trust the stored `ResearchItem` and `ResearchSummary` data already collected by the research layer.

Supported feed types:

| Feed type | Input examples | Stored content |
|---|---|---|
| YouTube | `https://www.youtube.com/@channel`, `/channel/...`, `/c/...`, `/user/...` | Latest video title, URL, publish date, transcript when available |
| Reddit | `wallstreetbets`, `/wallstreetbets`, `r/stocks`, `https://www.reddit.com/r/stocks` | Daily digest of top posts |
| RSS/Atom | Any feed URL | Latest article title, URL, publish date, excerpt/content |

Research sources get a slug from their name. Use that slug in pipeline prompts:

```txt
Consider Ziptrader's opinion: {ziptrader.summary} from {ziptrader.date}
Compare it with r/stocks: {stocks.summary}
```

Common reference fields:

| Reference | Meaning |
|---|---|
| `{ziptrader.summary}` | Latest stored item for `ziptrader`, summarized with that feed's **pipeline summary style** (feed override or global default prompt) |
| `{ziptrader.date}` | Latest item publish date as `YYYY-MM-DD` |
| `{ziptrader.title}` | Latest item title |
| `{ziptrader.url}` | Latest item URL |
| `{ziptrader.content}` | Latest collected source content/transcript |

For exact reuse of a prior daily pull, pin by date. This is implemented in the run resolver by matching the source slug, the `YYYY-MM-DD` key, and the requested field:

```txt
{ziptrader.2026-06-18.summary}
{wallstreetbets.2026-06-18.title}
```

The agent prompt editor includes an **Insert ref** menu that lists connected research feeds, shows which summary style each `{slug.summary}` uses, and inserts references such as `{ziptrader.summary}` and `{ziptrader.date}`.

Each research feed has an optional **Pipeline summary style** setting. When unset, pipelines use the global default summary prompt (seeded as **News Brief**). When set, that feed's pipelines always use the selected style for `{slug.summary}` and date-pinned `{slug.YYYY-MM-DD.summary}` refs. Summaries are reused from the database when already generated; otherwise the first pipeline run auto-generates them.

## Remote Provider Protection

All research source resolution and feed fetches go through a shared one-hour cache in the database. Repeated checks for the same provider/source reuse the cached result for one hour per cache key instead of repeatedly hitting the remote endpoint.

The cache applies to:

- YouTube source resolution and feed/transcript fetch paths
- Reddit OAuth/API or RSS fallback fetches
- RSS/Atom feed fetches
- Remote failures such as `403`, `429`, and `500`

Reddit uses `REDDIT_CLIENT_ID`, `REDDIT_SECRET`, and `REDDIT_USER_AGENT` when present, then falls back to Reddit RSS if OAuth fetches are unavailable.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| API server | Fastify + fastify-openapi-glue + TypeScript |
| Database | Prisma + MySQL |
| SDK | openapi-typescript + openapi-fetch + TanStack Query |
| Web | Vite + React + TypeScript + Tailwind CSS |
| AI | OpenAI text + image generation |
| Feeds | YouTube transcript/RSS, Reddit OAuth/RSS, RSS/Atom |

The OpenAPI spec at `packages/api-spec/openapi.yaml` is the API contract source of truth. SDK types in `packages/sdk/src/generated/types.ts` are generated from it.

## Project Layout

```txt
apps/
  server/          Fastify API server
  web/             Vite + React frontend
packages/
  api-spec/        OpenAPI YAML contract
  content/         Built-in templates, agents, and variable packs
  db/              Prisma schema + seed data
  sdk/             Generated types + React Query hooks
scripts/           Code generation and drift checks
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- MySQL 8

### 1. Install

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Minimum `.env`:

```env
DATABASE_URL=mysql://root:@localhost:3306/agentpress_dev
SESSION_SECRET=<random long secret>
OPENAI_API_KEY=sk-...
```

Optional Reddit OAuth configuration:

```env
REDDIT_CLIENT_ID=...
REDDIT_SECRET=...
REDDIT_USER_AGENT=AgentPress/1.0 by your_reddit_username
```

WSL2 + WAMP note: MySQL on the Windows host is usually not reachable as `localhost` from WSL. Use the Windows gateway IP from `ip route show | grep default`:

```env
DATABASE_URL=mysql://root:@172.x.x.1:3306/agentpress_dev
```

Grant WSL access in MySQL if needed:

```sql
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON agentpress_dev.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

### 3. Bootstrap And Run

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

For an existing database created before workspaces, replace the first command with `pnpm workspaces:migrate`. It creates nullable ownership columns, backfills and verifies every root resource, and then applies the required final schema. Run `pnpm db:seed` afterward to reconcile the public Community catalog.

Open [http://localhost:5173](http://localhost:5173) and log in with the seeded credentials:

```txt
admin@agentpress.local
password123
```

## Development Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start API and web in parallel |
| `pnpm build` | Production build for packages and apps |
| `pnpm typecheck` | TypeScript check across the workspace |
| `pnpm sdk:generate` | Regenerate SDK types from `openapi.yaml` |
| `pnpm sdk:check` | Verify generated SDK types match the OpenAPI spec |
| `pnpm db:push` | Sync Prisma schema to MySQL |
| `pnpm db:seed` | Seed demo users, accounts, prompts, pipelines, and research sources |
| `pnpm db:studio` | Open Prisma Studio |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `SESSION_SECRET` | Yes | AES-256 key material for encrypting WordPress credentials. Auth sessions use random database-backed session tokens. |
| `OPENAI_API_KEY` | Yes | Used for text and image generation |
| `PORT` | No | API server port, default `3001` |
| `VITE_API_URL` | No | Browser API base URL, default `http://localhost:3001` |
| `OPENAI_TEXT_MODEL` | No | Text generation model, default `gpt-4o` |
| `OPENAI_IMAGE_MODEL` | No | Image generation model, default `gpt-image-1` |
| `OUTPUT_ROOT` | No | Directory for saved run assets, default `./outputs` |
| `REDDIT_CLIENT_ID` | No | Reddit app client ID for OAuth-backed Reddit feeds |
| `REDDIT_SECRET` | No | Reddit app secret |
| `REDDIT_USER_AGENT` | No | Reddit API user agent |

## Pipeline Run Model

Runs are asynchronous. Starting a run returns a `running` run record immediately, and the frontend polls until the run reaches `completed`, `failed`, or `posted`.

At run start, AgentPress resolves any referenced research slugs from stored research data and merges them into the run variables. The resolved values are saved on the run, making the prompt render reproducible.

Prompt interpolation supports:

```txt
{topic}
{agents.researcher.output}
{ziptrader.summary}
{ziptrader.2026-06-18.summary}
```

Dry runs still call OpenAI and save generated outputs. Dry run means **no remote publishing** to WordPress.

## Agent Outputs And Final Post Assembly

Every agent produces an output. That output is always saved on the run and is always referenceable by UID:

```txt
{agents.researcher.output}
```

An agent output can also contribute to a final post field. Outputs that are not included in the final post are still saved and available to later agents.

| Output use | Final post behavior |
|---|---|
| Not included in final post | Saved only; available to later agents as `{agents.uid.output}` |
| `title` | Sets the final post title. If several agents target title, the latest title output wins. |
| `body` | Added to the final body. Current behavior concatenates body outputs in agent order. |
| `image` | Generates an inline document image and stores image metadata for the body composer. |
| `excerpt` | Sets the final excerpt. If several agents target excerpt, the latest excerpt output wins. |
| `thumbnail_prompt` | Sets the prompt used to generate the thumbnail image. If several agents target thumbnail prompt, the latest output wins. |

Current final post assembly:

```txt
Title            = latest title output
Excerpt          = latest excerpt output
Body             = included Body Composer rows
Thumbnail prompt = latest thumbnail_prompt output
Not included     = saved only, available to later agents
```

The Body Composer is a composition layer for arranging existing body and image outputs. Reordering or excluding composer rows does not trigger AI calls.

Inline image agents generate an image prompt, image asset, and metadata:

```json
{
  "prompt": "...",
  "relativePath": "images/section-hero-1.png",
  "path": "...",
  "url": "...",
  "alt": "...",
  "caption": "..."
}
```

Local artifacts embed inline images as figure blocks with relative paths:

```html
<figure>
  <img src="./images/section-hero-1.png" alt="..." />
</figure>
```

Before WordPress publishing, included inline images are uploaded to WordPress Media and the body HTML is rewritten to use WordPress media URLs. The thumbnail remains the featured image.

## Agent Output Reuse

AgentPress reuses unchanged agent outputs by default. Before an agent calls OpenAI, AgentPress renders the exact system and user prompts, combines them with the agent UID, output format, and configured text model, and hashes that input payload.

If a completed prior agent run in the same pipeline has the same input hash, AgentPress reuses that output instead of calling OpenAI.

Core cache rule:

```txt
Never call AI for an agent if its rendered inputs have not changed.
```

Rendered prompts naturally track dependencies. If an agent references `{subject}`, `{agents.researcher.output}`, or `{ziptrader.summary}`, a changed value changes the rendered prompt and therefore changes the hash.

Run view labels each agent output as:

| Label | Meaning |
|---|---|
| `generated` | OpenAI was called for this agent in this run |
| `reused` | Output was reused from a prior matching input hash |
| `failed` | The agent failed |

Run controls include:

- Default behavior: reuse unchanged outputs.
- Force regenerate all outputs.
- Force regenerate selected agents.

Changing publishing settings or Body Composer order/include settings does not trigger agent execution.

## Run Assets

Pipeline runs save local assets under `OUTPUT_ROOT` using the account slug, pipeline slug, and run ID. Examples include:

| Asset | Example filename |
|---|---|
| Final Markdown post | `post.md` |
| Structured generated post | `post.json` |
| Per-agent outputs | `agent-outputs.json` |
| Thumbnail prompt | `thumbnail-prompt.txt` |
| Downloaded thumbnail image | `thumbnail.png` |
| Publish metadata, when available | `publish-result.json` |

## WordPress Publishing

1. In WordPress, go to **Users → Profile → Application Passwords** and generate an application password.
2. In AgentPress, open a pipeline and go to **Setup → Destination**.
3. Add the WordPress site URL, username, and application password.
4. Select the destination for the pipeline.

WordPress destinations default to saving posts as drafts unless explicitly configured to publish directly.

Credentials are encrypted at rest with AES-256-CBC using `SESSION_SECRET`.

## URL Structure

| URL | Page |
|---|---|
| `/` | Accounts list |
| `/accounts/:accountSlug` | Account detail, pipelines, and research sources |
| `/accounts/:accountSlug/research/:sourceSlug` | Research source detail, items, and summary prompts |
| `/accounts/:accountSlug/pipelines/:pipelineSlug` | Pipeline builder |

## License

MIT
