# Account-Level Schedules Epic

## Summary

Schedules are account-level orchestration, not pipeline-owned timers. One schedule can check many research feeds and dispatch many pipelines through a reusable executor. Manual **Run now** is the first delivery target; the timed poller invokes the same executor after orchestration is proven.

## Configuration

A schedule belongs to an account and contains zero or more research feeds and zero or more pipeline actions. At least one feed or action is required. Each pipeline action stores variable overrides and one trigger policy:

- **Always run**
- **Any checked feed new**
- **Selected feeds new** (ANY selected feed is sufficient)

Conditional actions hold an independent cursor for every relevant source. New cursor relationships baseline at creation time, so old stored items do not trigger the first execution.

## Freshness and gating

The schedule executor owns gating. `ResearchService` only checks feeds, while `PipelineRunService` remains a generic run service.

For each execution the coordinator checks every configured feed once, establishes a cutoff, and evaluates each action independently. A source is fresh for an action when a `ResearchItem` was created after that action/source cursor and no later than the cutoff. Existing-item edits, transcript backfills, and other updates do not count.

Successful checks advance their action/source cursors after either a clean no-content decision or idempotent pipeline-run creation. Failed checks and pipelines that cannot start do not consume content. This makes freshness consumer-relative: multiple schedules and actions can independently react to the same item.

## Pinned run input

Conditional actions run once per execution. For every fresh trigger feed, the executor pins the newest eligible item by `publishedAt`. Ordinary references such as `{feed.summary}` use that item. Explicit date-pinned references are unchanged, and feeds without an override continue resolving their normal latest item.

Schedule pipeline executions are durable receipts containing the trigger decision, eligible items, pinned items, skip reason, and resulting pipeline run.

## UX

Account details expose a Schedules section with dedicated list and editor routes. The editor provides cadence and timezone controls, feed selection, multiple pipeline action cards, trigger policies, per-action variable overrides, validation, dirty-state Save, manual Run now, deletion, and execution history.

History shows feed outcomes, new-item counts, pipeline decisions, pinned items, and links to resulting runs.

## Data model

- `Schedule` stores account ownership, enabled state, calendar cadence, timezone, and next/last run times.
- `ScheduleSource` stores the ordered feeds checked by a schedule.
- `SchedulePipelineAction` stores ordered pipelines, trigger policy, and variable overrides.
- `SchedulePipelineTriggerSource` stores each action/source cursor.
- `ScheduleExecution` is the durable manual or timer orchestration receipt and lease.
- `ScheduleResearchCheck` records each provider check.
- `SchedulePipelineExecution` records each trigger decision and resulting pipeline run.
- `PipelineRun.schedulePipelineExecutionId` supplies unique provenance and idempotency.

A pipeline can appear once per schedule. Trigger sources must be schedule sources. Timer executions use a unique dedupe key.

## API and SDK

The authenticated API exposes:

- `GET/POST /api/accounts/{accountId}/schedules`
- `GET/PATCH/DELETE /api/schedules/{scheduleId}`
- `POST /api/schedules/{scheduleId}/run`
- `GET /api/schedules/{scheduleId}/executions`
- `GET /api/schedule-executions/{executionId}`

Create and update validate account ownership, cadence fields, trigger-source subsets, pipeline uniqueness, active pipeline requirements for timed runs, and required variable defaults or overrides. Manual Run now returns `202` and executes the saved configuration using normal trigger policies.

## Timed runtime

The server uses a database-backed poller without Redis. It calculates timezone-aware hourly, daily, weekly, and monthly occurrences, polls for due schedules, atomically advances `nextRunAt` while creating a deduplicated execution, and invokes the same executor used by Run now. Execution leases make abandoned work recoverable. Occurrences outside the configured grace window are recorded as missed and skipped rather than replayed.

Spring DST wall-clock gaps move to the next valid calendar occurrence. Repeated fall-back wall-clock times execute once.

## Legacy migration

An idempotent backfill converts each legacy recurring pipeline into an account schedule containing one unconditional action. Existing timezone and cadence values are retained; missing values use UTC, 09:00, Monday, or day 1 defaults. Pipeline-level timer controls are retired from the UI and API while their columns remain for one compatibility release.

## Acceptance tests

- One feed check can drive multiple independently gated pipelines.
- Separate actions and schedules can react to the same new item.
- Existing rows and content backfills never satisfy freshness.
- Failed feed checks do not advance cursors.
- Multiple eligible rows run once and pin the newest eligible item.
- Trigger policies, variable merging, ordering, idempotency, and skip reasons are durable.
- Manual and timed execution share orchestration behavior.
- Recurrence handles timezones, DST, missed occurrences, and duplicate claims.

## Delivery

1. Add persistence, API/SDK, editor UI, execution history, freshness cursors, pinned input, and manual Run now.
2. Add a database-backed timed poller with atomic claims, leases, deduplication, timezone-aware hourly/daily/weekly/monthly recurrence, and skipped missed occurrences.
3. Backfill legacy recurring pipeline settings into schedules, retire pipeline-level schedule controls, retain legacy columns for one compatibility release, then remove them.
