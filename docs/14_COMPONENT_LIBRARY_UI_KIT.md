# Component Library / UI Kit Documentation

## Page-level components

### Page

Generic page wrapper.

Props:

```ts
type PageProps = {
  title?: string
  actions?: React.ReactNode
  children: React.ReactNode
}
```

### Panel

Generic bordered content panel.

### Section

Generic titled section for sidebar/details.

### Row

Generic clickable row.

Props:

```ts
type RowProps = {
  title: string
  meta?: string
  selected?: boolean
  status?: React.ReactNode
  onClick?: () => void
}
```

## Account components

### AccountList

Composes account rows.

### AccountForm

Used for create/edit.

### AccountHeader

Displays account metadata at top of account detail.

## Pipeline list components

### PipelineList

Displays pipelines owned by an account.

### PipelineRow

Can remain domain-specific because pipeline summary has unique actions/status.

## Builder components

### BuilderShell

Owns two-panel builder layout.

### BuilderSidebar

Renders four sections:

- Setup
- Variables
- Agents
- Runs

Uses generic `Section` and `Row`.

### DetailPanel

Switches selected view:

- BuilderSetup
- BuilderVariable
- BuilderAgent
- BuilderRun

## Builder detail views

### BuilderSetup

Destination, dry-run/live mode, schedule, active/paused.

### BuilderVariable

Variable key, label, type, required/default/example.

### BuilderAgent

Agent UID, name, output target, output format, system prompt, user prompt.

### BuilderRun

Generated content first, then assets, publishing info, agent outputs.

## Prompt components

### PromptField

Prompt editor with insert controls and AI assist.

Props:

```ts
type PromptFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  variables: PipelineVariable[]
  previousAgents: PipelineAgent[]
  onAssist: (instruction: string) => Promise<string>
}
```

### InsertReferenceMenu

Dropdown for variables and previous agent outputs.

### PromptAssist

Inline non-chat prompt helper.

Behavior:

1. User clicks AI Assist.
2. User enters short instruction.
3. Suggested prompt is returned.
4. User clicks Apply or Cancel.

## Component naming rules

Use domain names only when the component owns product meaning:

- BuilderAgent
- BuilderRun
- PipelineRow

Use generic names for visual shapes:

- Row
- Section
- Panel
- Badge
- Card

Avoid creating files like:

- AgentSidebarCard
- VariableSidebarRow
- RunSidebarItem

Those are usually generic `Row` compositions.
