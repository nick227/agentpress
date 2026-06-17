# API Contract / Shared Type Definitions

## Base response patterns

```ts
type ApiError = {
  code: string
  message: string
  details?: unknown
}
```

## Accounts

### GET /api/accounts

Returns all accounts.

```ts
type ListAccountsResponse = {
  accounts: AccountSummary[]
}

type AccountSummary = {
  id: string
  name: string
  category?: string
  phone?: string
  email?: string
  description?: string
  pipelineCount: number
  lastRunAt?: string
}
```

### POST /api/accounts

```ts
type CreateAccountRequest = {
  name: string
  category?: string
  phone?: string
  email?: string
  description?: string
}

type CreateAccountResponse = {
  account: Account
}
```

### PATCH /api/accounts/:accountId

```ts
type UpdateAccountRequest = Partial<CreateAccountRequest>

type UpdateAccountResponse = {
  account: Account
}
```

### DELETE /api/accounts/:accountId

```ts
type DeleteAccountResponse = {
  ok: true
}
```

## Pipelines

### GET /api/accounts/:accountId/pipelines

```ts
type ListPipelinesResponse = {
  pipelines: PipelineSummary[]
}

type PipelineSummary = {
  id: string
  accountId: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  agentCount: number
  lastRunAt?: string
}
```

### POST /api/accounts/:accountId/pipelines

```ts
type CreatePipelineRequest = {
  name: string
  description?: string
}

type CreatePipelineResponse = {
  pipeline: Pipeline
}
```

### GET /api/pipelines/:pipelineId

```ts
type GetPipelineResponse = {
  pipeline: Pipeline
  recentRuns: PipelineRunSummary[]
}
```

### PATCH /api/pipelines/:pipelineId

```ts
type UpdatePipelineRequest = {
  name?: string
  description?: string
  status?: 'draft' | 'active' | 'paused' | 'archived'
  setup?: PipelineSetup
  variables?: PipelineVariableInput[]
  agents?: PipelineAgentInput[]
}

type UpdatePipelineResponse = {
  pipeline: Pipeline
}
```

## Prompt assist

### POST /api/prompt-assist

```ts
type PromptAssistRequest = {
  pipelineName: string
  variables: PipelineVariable[]
  previousAgents: PipelineAgent[]
  currentAgent?: PipelineAgent
  promptKind: 'system' | 'user'
  currentPrompt?: string
  userInstruction: string
}

type PromptAssistResponse = {
  suggestedPrompt: string
  warnings?: string[]
}
```

## Pipeline runs

### POST /api/pipelines/:pipelineId/runs

```ts
type StartPipelineRunRequest = {
  variables: Record<string, unknown>
  dryRun?: boolean
}

type StartPipelineRunResponse = {
  run: PipelineRun
}
```

### GET /api/pipeline-runs/:runId

```ts
type GetPipelineRunResponse = {
  run: PipelineRun
  agentRuns: AgentRun[]
  assets: RunAsset[]
  publishAttempts: PublishAttempt[]
}
```

### GET /api/pipeline-runs/:runId/assets/:assetId

Returns or downloads the saved asset.

## Destinations

MVP can keep destination selection simple, but API should support CRUD.

```ts
type DestinationInput = {
  accountId: string
  type: 'wordpress'
  name: string
  siteUrl: string
  username?: string
  secret?: string
  defaultStatus: 'draft' | 'publish'
}
```

## Validation

### POST /api/pipelines/:pipelineId/validate

```ts
type ValidatePipelineResponse = {
  valid: boolean
  errors: PipelineValidationIssue[]
  warnings: PipelineValidationIssue[]
}

type PipelineValidationIssue = {
  level: 'error' | 'warning'
  message: string
  path?: string
}
```
