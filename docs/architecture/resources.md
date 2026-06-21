# Resource Contract

AgentPress reusable resources follow a catalog/fork/override model. This keeps
public discovery separate from private operational state and gives new resource
types a predictable lifecycle.

## Layers

### Community catalog

- Public and readable.
- Provides stable templates and defaults.
- Forkable into a workspace.
- Read-only to ordinary workspaces.
- Never owns credentials, execution history, or mutable operational state.

### Workspace library

- Private to the workspace unless explicitly published.
- Editable and executable by authorized workspace members.
- Owns credentials, schedules, generated data, and execution history.
- May retain provenance back to a community resource.

## Identity and resolution

Reusable resources have a stable machine `key`. Names are presentation and
slugs are workspace-scoped routes; neither should define override identity.

Resolve a reusable resource by key in this order:

1. Current workspace resource.
2. Public community resource.
3. Missing.

A workspace resource shadows a community resource with the same key. Catalog
reads may use this resolved view, while workspace navigation must list only
resources the workspace owns.

## Materialization and operation

Community resources must be materialized into the workspace before any mutation
or operational use. Create, update, delete, check, schedule, and run operations
must never target shared community state.

- Pipelines are forked before editing or running.
- Feeds are added to the workspace before checking or pipeline execution.
- Agents are reusable definitions. Inserting one copies an executable snapshot
  into a `PipelineAgent`; edits to the source Agent never sync implicitly.
- Prompts are forked/saved privately; applying one copies its text into agent
  state and does not create a live runtime dependency.
- Schedules may eventually be catalog templates, but executable schedules are
  workspace-owned.
- Runs are private historical records, not reusable catalog resources.
- Destinations and credentials are always workspace-owned and private.

For strict MVP behavior, a pipeline that references a community feed without a
workspace copy fails validation and execution with an instruction to add it.
Auto-materialization may be introduced later only if the mutation is visible to
the user and preserves this ownership boundary.

## Common fields

Reusable resource models should converge on:

- `workspaceId`
- `visibility`
- `kind` or `type`
- `key`
- `slug`
- `name`
- a type-safe source/fork relation such as `sourcePromptId`
- `createdByUserId`

Fork provenance should be retained for attribution and updates, but execution
must use a workspace-owned snapshot rather than mutable community state.

## Agent lifecycle

- `Agent` is a reusable workspace/community definition with a suggested
  `defaultUid`.
- `PipelineAgent` is an executable snapshot with its own pipeline-local `uid`
  and optional `sourceAgentId` provenance.
- `AgentRun` records the rendered prompts, kind, format, and result for one
  snapshot execution.

Resolved Agent catalogs prefer workspace Agents over Community Agents with the
same key. Insertion assigns a unique local UID (`writer`, `writer_2`, …) and
does not create a live runtime dependency. Static-image Agent definitions do
not contain `selectedImageAssetId`; the pipeline must bind an owned image before
validation or execution succeeds.
