# Data Model / Schema Outline

## Account

```ts
type Account = {
  id: string
  name: string
  category?: string
  phone?: string
  email?: string
  description?: string
  createdAt: string
  updatedAt: string
}
```

## Pipeline

```ts
type Pipeline = {
  id: string
  accountId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  setup: PipelineSetup
  variables: PipelineVariable[]
  agents: PipelineAgent[]
  createdAt: string
  updatedAt: string
}
```

## PipelineSetup

```ts
type PipelineSetup = {
  destinationId?: string
  dryRun: boolean
  scheduleMode: 'manual' | 'recurring'
  frequency?: 'daily' | 'weekly' | 'monthly'
  timeOfDay?: string
  timezone?: string
  isPaused: boolean
}
```

## PipelineVariable

```ts
type PipelineVariable = {
  id: string
  pipelineId: string
  key: string
  label?: string
  type: 'text' | 'long_text' | 'number' | 'boolean' | 'json'
  required: boolean
  defaultValue?: unknown
  exampleValue?: unknown
  sortOrder: number
}
```

## PipelineAgent

```ts
type PipelineAgent = {
  id: string
  pipelineId: string
  uid: string
  name: string
  systemPrompt: string
  userPrompt: string
  outputTarget: 'title' | 'excerpt' | 'thumbnail_prompt' | 'body'
  outputFormat: 'text' | 'markdown' | 'json'
  enabled: boolean
  sortOrder: number
}
```

## PipelineRun

```ts
type PipelineRun = {
  id: string
  accountId: string
  pipelineId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'posted'
  dryRun: boolean
  variables: Record<string, unknown>
  generatedPost?: GeneratedPost
  outputFolder?: string
  destinationId?: string
  startedAt: string
  completedAt?: string
  error?: string
}
```

## AgentRun

```ts
type AgentRun = {
  id: string
  pipelineRunId: string
  agentUid: string
  agentName: string
  outputTarget: 'title' | 'excerpt' | 'thumbnail_prompt' | 'body'
  renderedSystemPrompt: string
  renderedUserPrompt: string
  outputText?: string
  outputJson?: unknown
  status: 'queued' | 'running' | 'completed' | 'failed'
  error?: string
  sortOrder: number
  startedAt?: string
  completedAt?: string
}
```

## GeneratedPost

```ts
type GeneratedPost = {
  title: string
  excerpt: string
  thumbnailPrompt?: string
  thumbnailUrl?: string
  body: string
}
```

## RunAsset

```ts
type RunAsset = {
  id: string
  pipelineRunId: string
  type: 'text' | 'json' | 'image'
  label: string
  filename: string
  path: string
  url?: string
  createdAt: string
}
```

## Destination

```ts
type Destination = {
  id: string
  accountId: string
  type: 'wordpress'
  name: string
  siteUrl: string
  authType: 'application_password' | 'token'
  username?: string
  encryptedSecretRef: string
  defaultStatus: 'draft' | 'publish'
  createdAt: string
  updatedAt: string
}
```

## PublishAttempt

```ts
type PublishAttempt = {
  id: string
  pipelineRunId: string
  destinationId: string
  status: 'pending' | 'success' | 'failed'
  remotePostId?: string
  remoteUrl?: string
  error?: string
  createdAt: string
}
```

## Prisma-style relations

```txt
Account 1 ── * Pipeline
Account 1 ── * Destination
Pipeline 1 ── * PipelineVariable
Pipeline 1 ── * PipelineAgent
Pipeline 1 ── * PipelineRun
PipelineRun 1 ── * AgentRun
PipelineRun 1 ── * RunAsset
PipelineRun 1 ── * PublishAttempt
Destination 1 ── * PublishAttempt
```
