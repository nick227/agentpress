# Technical Requirements / Stack Decision Doc

## Recommended stack

### Frontend

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- Tailwind CSS
- shadcn-style primitives or local UI primitives

### Backend

- Node.js
- Fastify
- TypeScript
- Prisma
- MySQL or PostgreSQL
- OpenAPI-generated client SDK

### AI

- OpenAI only for MVP
- Text generation for agents
- Text generation for prompt assist
- Image generation for thumbnails

### Storage

MVP options:

- Local filesystem for dev
- S3-compatible object storage for production later

Run output folder convention:

```txt
outputs/{accountSlug}/{pipelineSlug}/{runId}/
```

Files:

```txt
post.md
post.json
thumbnail-prompt.txt
thumbnail.png
publish-result.json
agent-outputs.json
```

## Frontend page structure

```txt
src/pages/
  AccountsPage.tsx
  AccountDetailPage.tsx
  PipelineBuilderPage.tsx
```

## Frontend feature structure

```txt
src/features/
  accounts/
  pipelines/
```

## Pipeline component structure

```txt
features/pipelines/components/
  list/
    PipelineList.tsx
    PipelineRow.tsx
  builder/
    BuilderShell.tsx
    BuilderSidebar.tsx
    DetailPanel.tsx
    setup/
      BuilderSetup.tsx
    variables/
      BuilderVariable.tsx
    agents/
      BuilderAgent.tsx
      PromptField.tsx
      InsertReferenceMenu.tsx
      PromptAssist.tsx
    runs/
      BuilderRun.tsx
```

## Shared generic components

```txt
components/layout/
  Page.tsx
  Panel.tsx
  Section.tsx
  Stack.tsx
  SplitPane.tsx

components/ui/
  Button.tsx
  Input.tsx
  Textarea.tsx
  Select.tsx
  Checkbox.tsx
  Badge.tsx
  Card.tsx
  Row.tsx
```

## Required services

```txt
AccountService
PipelineService
PipelineRunService
PromptRenderService
OpenAIService
OutputAssetService
WordPressService
ScheduleService
```

## Environment variables

```txt
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=
OPENAI_IMAGE_MODEL=
OUTPUT_ROOT=./outputs
APP_BASE_URL=
SESSION_SECRET=
```

## MVP runtime behavior

1. User starts a run.
2. Backend loads pipeline definition.
3. Backend renders agent prompts with variables and prior outputs.
4. Backend calls OpenAI for each agent.
5. Backend assembles `GeneratedPost`.
6. Backend saves output assets.
7. Backend posts to WordPress if not dry run.
8. Backend records run status and asset/publish metadata.

## Scheduling requirement

Simple recurring schedule can be represented as stored config first. Actual background scheduler can be implemented after manual run flow is stable.

## Non-functional requirements

- Prompt/render errors must be visible.
- References must be validated before execution.
- Runs must be immutable receipts where possible.
- Dry run must never post remotely.
- Live run should still save local assets before/after posting.
- Failed posting should not delete generated assets.
