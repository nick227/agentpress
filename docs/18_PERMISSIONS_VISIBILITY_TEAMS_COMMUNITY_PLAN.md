# Permissions, Visibility, Teams, and Community Plan

## Status

Proposed product and implementation plan. This document replaces the original single-owner permission assumptions for new work. It does not change the current schema by itself.

## Goals

- Give every resource an unambiguous owner and authorization boundary.
- Support personal workspaces and collaborative team workspaces.
- Build a public Community catalog without exposing credentials, private inputs, or execution history.
- Make all seed pipelines and feeds public Community resources.
- Define consistent rules for pipelines, feeds, destinations, runs, and schedules.
- Keep authorization decisions on the server and make them straightforward to test.

## Core decisions

### 1. Ownership and visibility are separate

Every top-level resource belongs to exactly one workspace. A workspace is one of:

- **Personal**: owned by one user.
- **Team**: shared by team members according to their role.
- **Community**: a system-managed public workspace containing curated examples and seed data.

Ownership answers **who can manage this?** Visibility answers **who can discover and read this?** A resource cannot be made public merely by changing its owner.

The initial visibility values are:

- `PRIVATE`: visible only to authorized members of the owning workspace.
- `PUBLIC`: discoverable and readable by everyone, including signed-out visitors where the route permits it.

Do not add `UNLISTED` in the first release. It has different link-sharing and revocation semantics and can be added later.

### 2. Public means readable and reusable, not editable or executable in place

Public resources are immutable to the audience. A user reuses a public pipeline or feed by adding/forking it into a personal or team workspace. The resulting resource is private by default and records its origin.

Only members with sufficient permission in the owning workspace can edit or delete a public resource. Community seed resources are managed by the system, not by ordinary users.

Viewing a public definition never grants access to:

- destination configuration or credentials;
- private feed credentials or fetched private content;
- run inputs, prompts after interpolation, outputs, logs, or assets;
- schedule execution history;
- team membership or private workspace metadata.

### 3. Execution always has a private workspace context

A pipeline run must belong to the personal or team workspace that initiated it. Running a public pipeline does not create a public run and does not execute against the Community workspace.

The executor resolves feeds, secrets, destination access, and schedule permissions from the run's workspace. It must reject cross-workspace references unless the referenced resource is explicitly public and allowed for that relationship.

### 4. Community is a curated catalog, not a giant shared team

Community is a special system workspace used for public examples, starter pipelines, and safe public feeds. It has no ordinary membership and cannot own secrets or execute jobs.

In the first release:

- existing seed pipelines and research feeds move to Community and are `PUBLIC`;
- ordinary users may browse, fork, and add Community resources;
- user publishing to Community is deferred until moderation, reporting, and abuse controls exist;
- future user-owned public resources may appear in the Community catalog without transferring ownership to Community.

## Resource policy

| Resource | Allowed owner | Allowed visibility | Community behavior | Important rule |
|---|---|---|---|---|
| Pipeline | Personal, Team, Community | Private or public | Seeded public templates | Public pipelines can be viewed and forked, but not edited or executed in Community. |
| Feed | Personal, Team, Community | Private or public | Seeded public sources and public collected items | Only credential-free sources and redistribution-safe content may be public. |
| Destination | Personal, Team | Private only | Not allowed | Credentials and publishing configuration are never public. |
| Run | Personal, Team | Private only | Not allowed | A run snapshots its initiating workspace and remains private even when its pipeline is public. |
| Schedule | Personal, Team | Private only | Not allowed | Active orchestration is private. Public schedule templates are deferred and would be a separate template type. |
| Schedule execution | Personal, Team (inherited) | Private only | Not allowed | Inherits access from its schedule; cannot be shared independently. |

### Pipelines

- A pipeline carries `workspaceId` and `visibility`.
- Agents, variables, and reusable image assets inherit pipeline ownership and visibility; they cannot be shared independently.
- Public pipeline reads return the reusable definition only. They omit internal audit data and any bound private destination.
- A public pipeline cannot have a destination binding. When a pipeline is made public, the API must require `destinationId = null`.
- **Fork** creates a complete private copy in a target workspace, excluding destination bindings, run history, schedules, and generated assets.
- The fork records `sourcePipelineId`, `sourceVersion` or source timestamp, and `forkedAt`. It does not receive future source changes automatically.
- A user may run a public pipeline through a **use** action that first creates or identifies a private fork. There is no public execution context.
- Changing a public pipeline back to private removes it from discovery but does not delete existing forks.

### Feeds

- A feed carries `workspaceId` and `visibility`.
- Research items and summaries inherit the feed's access rules.
- A Community feed is a shared, system-checked source. Adding it to a workspace should create a lightweight subscription/reference, not duplicate provider polling.
- A private feed is workspace-managed and may use credentials. Its source configuration, items, summaries, errors, and check history remain private.
- A feed can be public only when its adapter declares it safe for public use and it has no workspace secret. The server enforces this; the client cannot override it.
- Community feed slugs are globally stable. Private feed slugs need only be unique within their workspace.
- Pipeline references resolve in this order: a feed attached to the pipeline/workspace, then an explicitly attached Community feed. Do not resolve arbitrary private feeds by global slug.
- If licensing or provider terms do not permit redistributing full content, the Community item stores and displays only permitted metadata/derived summaries. Public status is not permission to republish third-party content.

### Destinations

- A destination carries `workspaceId` and is always private.
- Secret material remains encrypted and is never returned after creation.
- Only team members with destination-management permission may create, edit, test, or delete a destination.
- Editors may bind an existing destination to a pipeline only if they can use destinations in that workspace. Viewers never receive credential fields.
- A destination cannot be referenced from another workspace, including a user's personal workspace.
- Publish attempts inherit run access and expose only sanitized errors to roles that cannot manage destinations.

### Runs

- A run carries `workspaceId`, `pipelineId`, and `createdByUserId`. `workspaceId` is copied at creation and is not inferred later.
- Runs are private. Public sharing of generated output, if desired later, should use a separate published artifact/share-link model with explicit revocation.
- A run created from a public pipeline records the source pipeline and version used, while its variables, rendered prompts, outputs, assets, errors, and costs remain private.
- Only members allowed to run pipelines can start, cancel, retry, or publish a run. Viewers may inspect run output in their workspace but cannot execute or publish.
- Deleting or transferring a pipeline must not silently change access to historical runs. Runs retain their workspace and immutable pipeline snapshot/provenance.
- Asset download endpoints perform the same workspace authorization as the run endpoint; obscurity of a file path is not authorization.

### Schedules

- A schedule carries `workspaceId`, `createdByUserId`, and private visibility.
- Every selected pipeline, feed, and destination must be usable from the schedule's workspace. Community feeds may be attached; resources from other personal/team workspaces may not.
- Creating or editing schedule structure requires pipeline edit permission. Enabling, disabling, or manually triggering it requires run permission.
- A schedule that could publish live also requires destination-use permission at enable and execution time.
- The poller runs as the system but evaluates the schedule using its owning workspace. It does not bypass resource boundaries.
- Membership or role changes take effect on future manual actions. Timed schedules continue as team-owned automation until an authorized member disables them.
- Schedule and pipeline executions remain durable private audit records.

## Team roles and permissions

Personal workspaces give their owner all permissions. Community access is read/fork only. Team workspaces use four roles:

- **Owner**: full control, including team deletion and ownership transfer.
- **Admin**: manage members, resources, visibility, and destinations; cannot delete the team or transfer ownership.
- **Editor**: create and edit content resources, run pipelines, manage schedules, and use existing destinations; cannot manage members, secrets, or public visibility.
- **Viewer**: read private team resources and run history; cannot mutate, execute, or publish.

| Capability | Owner | Admin | Editor | Viewer |
|---|---:|---:|---:|---:|
| View team resources and runs | Yes | Yes | Yes | Yes |
| Create/edit/delete pipelines and feeds | Yes | Yes | Yes | No |
| Fork Community resources into team | Yes | Yes | Yes | No |
| Run pipeline / retry run | Yes | Yes | Yes | No |
| Create/edit/trigger schedules | Yes | Yes | Yes | No |
| Use an existing destination for publishing | Yes | Yes | Yes | No |
| Create/edit/test/delete destination or secret | Yes | Yes | No | No |
| Make a resource public/private | Yes | Yes | No | No |
| Invite/remove members and change roles | Yes | Yes* | No | No |
| Delete team / transfer ownership | Yes | No | No | No |

`*` Admins cannot remove, demote, or replace the Owner and cannot grant the Owner role.

Destructive operations should also follow these rules:

- the last Owner cannot leave or be removed;
- deleting a team requires explicit confirmation and a background cascade/retention policy;
- removing a member does not delete resources or runs they created because those belong to the team;
- user suspension immediately invalidates sessions and membership-derived access.

## Proposed data model

Use a concrete `Workspace` rather than polymorphic `ownerType`/`ownerId` columns. This keeps foreign keys and authorization queries simple.

```prisma
enum WorkspaceType {
  PERSONAL
  TEAM
  COMMUNITY
}

enum Visibility {
  PRIVATE
  PUBLIC
}

enum TeamRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

model Workspace {
  id        String        @id @default(cuid())
  type      WorkspaceType
  name      String
  slug      String        @unique
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  members   WorkspaceMember[]
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        TeamRole
  joinedAt    DateTime @default(now())

  @@id([workspaceId, userId])
  @@index([userId])
}
```

Add required ownership to all operational roots:

- `Pipeline.workspaceId`, `Pipeline.visibility`, `Pipeline.createdByUserId`, and fork provenance.
- `ResearchSource.workspaceId`, `ResearchSource.visibility`, and `ResearchSource.createdByUserId`.
- `Destination.workspaceId` and `Destination.createdByUserId`.
- `PipelineRun.workspaceId` and `PipelineRun.createdByUserId`.
- `Schedule.workspaceId` and `Schedule.createdByUserId`.

Add explicit feed relationships instead of resolving every globally visible slug:

- `WorkspaceFeedSubscription(workspaceId, sourceId, createdByUserId)` records a Community/public feed added to a personal or team workspace.
- `PipelineFeed(pipelineId, sourceId, alias)` records the feeds a pipeline may reference. Its source must either belong to the pipeline workspace or be a public feed subscribed to by that workspace.
- Subscription and attachment rows do not copy research items. A forked private feed, by contrast, becomes a new independently checked source with its own items.

Children inherit access through their parent. Do not duplicate visibility onto pipeline agents, research items, run assets, publish attempts, or schedule executions.

Recommended constraints and indexes:

- unique personal workspace membership/ownership per user;
- one workspace with type `COMMUNITY`, enforced by application invariant or a fixed well-known ID;
- unique resource slug within a workspace: `@@unique([workspaceId, slug])`;
- list indexes such as `@@index([workspaceId, visibility, updatedAt])`;
- no destination relation from a public or Community pipeline, enforced transactionally;
- no `PUBLIC` destination, run, or schedule value because those models do not need a visibility column;
- immutable `workspaceId` after a run or execution is created.

## Authorization architecture

### Central policy service

Introduce one server-side authorization layer rather than scattering role checks through handlers. It should expose intent-based checks such as:

```ts
authorize(user, 'pipeline:read', pipeline)
authorize(user, 'pipeline:edit', pipeline)
authorize(user, 'pipeline:run', pipeline)
authorize(user, 'destination:manage', destination)
authorize(user, 'destination:use', destination)
authorize(user, 'schedule:trigger', schedule)
```

Handlers load the resource, authorize the intended action, and only then call the service. Services that can be reached by the poller or other internal code must also validate workspace compatibility so authorization cannot be bypassed through a different entry point.

### Query rules

- Private list queries always start with a permitted `workspaceId`; never fetch globally and filter in memory.
- Public catalog queries use `visibility = PUBLIC` and a safe explicit projection.
- IDs and globally unique slugs are locators, not proof of access.
- Relation writes validate that both sides belong to the same workspace, except for the explicit Community-feed attachment case.
- Return `404` for an inaccessible private resource to avoid confirming its existence. Return `403` when the resource is already visible but the requested mutation is forbidden.
- Cache keys include workspace and visibility context. A response cached for a public request must never contain a private projection.

### Audit events

Record actor, workspace, action, target, timestamp, and relevant safe metadata for:

- membership and role changes;
- visibility changes and Community publishing decisions;
- destination secret changes and connection tests;
- pipeline and schedule execution/cancellation;
- live publish attempts;
- team deletion or ownership transfer.

Never store secret values or full sensitive run inputs in the audit metadata.

## API and UX plan

### Routes and API shape

- Scope private APIs by workspace: `/api/workspaces/{workspaceId}/pipelines`, feeds, destinations, runs, and schedules.
- Add `/api/community/pipelines` and `/api/community/feeds` with safe public response types.
- Add `POST /api/pipelines/{id}/fork` with a required target `workspaceId`.
- Add team membership endpoints under `/api/workspaces/{workspaceId}/members`.
- Include `workspace`, `visibility`, `canEdit`, `canRun`, `canManageVisibility`, and similar computed capabilities in UI-facing responses.
- Do not rely on hidden buttons for security; capability fields improve UX while the server remains authoritative.

### Navigation

- Add a workspace switcher with **Personal**, each joined **Team**, and **Community**.
- Community has dedicated Pipeline and Feed browsing pages with **Use in workspace** actions.
- Resource pages show an owner badge and a `Private` or `Public` badge.
- Only Owner/Admin see visibility controls. Destinations, Runs, and Schedules always show `Private` without a visibility selector.
- Fork dialogs explain that destinations, schedules, history, and generated assets are not copied.

## Seed data policy

All product seed data intended as examples must be owned by the Community workspace and public:

- seeded pipelines, their agents, and variables;
- seeded credential-free research feeds and permitted public research metadata/summaries;
- reusable global summary prompts, if kept as a catalog resource.

Seed data must not include a live destination, real credentials, private run history, or enabled schedules. Demo-only private resources should be created separately in the seeded demo user's personal workspace and clearly labeled as demo data.

The seed must be idempotent:

1. Upsert the fixed Community workspace.
2. Upsert public Community feeds and pipelines by `(workspaceId, slug)`.
3. Reconcile their child definitions without touching user forks.
4. Upsert a demo user and that user's personal workspace.
5. Never change ownership or visibility of a user-created resource merely because its slug matches a seed slug.

## Migration plan

The current schema authenticates users but stores pipelines, feeds, destinations, runs, and schedules globally. Roll out ownership before exposing team or Community UI.

### Implementation warning: ownership first, Community later

Do not build Community discovery, public catalog queries, or forking on top of globally scoped resources. Ownership and authorization must be complete first; otherwise public/private behavior will be difficult to secure and later migrations will mix access-control changes with product behavior.

The required implementation order is:

1. Add `Workspace` and `WorkspaceMember`.
2. Backfill every existing resource into either the legacy user's personal workspace or the fixed Community workspace.
3. Verify the backfill and make every root resource's `workspaceId` required.
4. Add the central `authorize()` policy service.
5. Scope every private read and write query by `workspaceId`, including nested resources, assets, execution workers, and background jobs.
6. Add Team APIs and UI only after workspace isolation tests pass.
7. Add the Community catalog, subscriptions, and pipeline forking only after Team authorization is stable.

Each step is a release gate for the next. Community ownership may be assigned during backfill, but Community resources must not be exposed through public endpoints until steps 1–6 are complete.

### Phase 1: Add ownership without changing behavior

1. Add `Workspace`, `WorkspaceMember`, role/visibility enums, and nullable `workspaceId` columns.
2. Create a personal workspace for every user and one fixed Community workspace.
3. Assign existing non-seed resources to the current owner/admin user's personal workspace.
4. Assign recognized seed pipelines and feeds to Community with `PUBLIC` visibility.
5. Backfill runs from their pipeline workspace and schedules/destinations from their related resources or the legacy owner workspace.
6. Add consistency verification queries, then make ownership columns required.

### Phase 2: Enforce authorization

1. Add the central policy service and workspace-scoped repository queries.
2. Protect every read, mutation, asset download, publish action, and nested route.
3. Validate all cross-resource workspace relationships.
4. Include workspace claims/capabilities in API and SDK types.
5. Add audit events and revoke authorization caches on membership changes.

**Exit gate:** all resource queries and background execution paths are workspace-scoped, and cross-workspace isolation tests pass before any Team or Community UI ships.

### Phase 3: Teams

1. Add team creation, membership invitations, role changes, removal, and workspace switching.
2. Add team-scoped lists and creation flows.
3. Verify that automations remain team-owned when their creator leaves.
4. Add ownership-transfer and team-deletion safeguards.

**Exit gate:** membership changes, all four team roles, destination permissions, and team-owned automation pass end-to-end authorization tests before public catalog work begins.

### Phase 4: Community

1. Add public catalog endpoints and signed-out safe projections.
2. Add Pipeline fork and Community Feed subscription flows.
3. Move the seed catalog to Community and remove duplicate per-user seeded copies.
4. Add attribution/provenance in forked resources.
5. Add moderation and abuse requirements before allowing user submissions to the public catalog.

## Security and privacy requirements

- Default every user-created resource to private.
- Require an explicit Owner/Admin action and confirmation to make eligible resources public.
- Prevent public pipelines from containing secrets embedded in prompts. Before publication, scan for known secret fields and present a checklist; server-side eligibility remains required.
- Sanitize public descriptions, names, prompt Markdown, and external URLs against script injection.
- Rate-limit signed-out catalog reads, forks, feed checks, runs, invitations, and publishing actions independently.
- Treat rendered prompts and provider errors as potentially sensitive.
- Prevent private URLs and local file paths from appearing in public projections.
- Recheck membership and destination permission when a run publishes, not only when the run begins.
- Define retention and deletion behavior for team runs and assets before team deletion ships.

## Acceptance criteria

- A new user receives one private personal workspace and cannot see another user's private resources by ID, slug, asset URL, or nested endpoint.
- A team Viewer can inspect team pipelines and runs but cannot mutate, execute, schedule, publish, or manage destinations.
- A team Editor can build and run pipelines and use an existing destination but cannot view or replace its secret.
- Removing a team member immediately removes access while preserving team-owned resources they created.
- Community seed pipelines and feeds are readable without team membership and can be added/forked into an authorized workspace.
- Forking a Community pipeline copies its definition but not destinations, schedules, runs, or assets; the fork is private by default.
- Running a Community pipeline produces a private run in the initiating personal/team workspace.
- Community feeds with no credentials can be shared; a credentialed feed cannot be made public.
- Destinations, runs, schedules, and schedule executions cannot be made public through the API.
- A schedule cannot connect resources from two private workspaces, and the poller cannot bypass that rule.
- Public API projections contain no secrets, private relation IDs, rendered run prompts, internal paths, or private execution metadata.
- Seed reruns update Community seed definitions without modifying or deleting user forks.

## Deferred decisions

- User submissions and moderation for the Community catalog.
- Public profiles, likes, comments, ratings, and discovery ranking.
- Unlisted link sharing and expiring run-output share links.
- Automatic upstream updates or pull requests for forked pipelines.
- Public schedule templates as a distinct non-executable resource.
- Billing, quotas, and cost attribution across personal and team workspaces.
- Enterprise custom roles and resource-level exceptions.
