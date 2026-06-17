# Third-Party Integrations and Dependencies

## OpenAI

Used for:

- Agent text generation
- JSON/structured output generation if needed
- Inline prompt assist
- Thumbnail image generation

Environment:

```txt
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
OPENAI_IMAGE_MODEL=
```

MVP service methods:

```ts
OpenAIService.generateText()
OpenAIService.generateJson()
OpenAIService.generateImage()
```

## WordPress

Used for:

- Creating draft/live posts
- Sending title, excerpt, body
- Future: uploading featured image to Media Library

MVP auth option:

- WordPress Application Passwords

MVP publish fields:

```ts
type WordPressPostPayload = {
  title: string
  excerpt: string
  content: string
  status: 'draft' | 'publish'
}
```

Future fields:

- categories
- tags
- featured_media
- slug
- meta description via SEO plugin integration

## File storage

MVP local filesystem:

```txt
OUTPUT_ROOT=./outputs
```

Future production:

- S3
- Cloudflare R2
- DigitalOcean Spaces
- Railway/Render persistent disk if available

## Scheduler

MVP options:

- Manual runs first
- Later: simple cron-like scheduler inside backend
- Better production: job queue + worker

Future dependencies:

- BullMQ + Redis
- Temporal
- Cloud scheduler

## Database

Recommended:

- MySQL or PostgreSQL via Prisma

## Frontend dependencies

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Tailwind CSS

## Backend dependencies

- Fastify
- Prisma
- Zod or TypeBox validation
- OpenAPI tooling
- OpenAI SDK
- File system utilities
