# Product Requirements Document / Scope

## Product name

Working name: AgentPress

## One-line description

A minimal AI pipeline builder where accounts own ordered agent pipelines that generate structured blog posts, save local output assets, and optionally publish to WordPress.

## Problem

AI writing tools often produce content from one large prompt, making results hard to tune, audit, reuse, or adapt per client/site. Users need a simple way to define repeatable content workflows made of focused agents, with visible inputs, outputs, saved assets, and publishing history.

## Product goals

- Let users create accounts representing clients, brands, sites, or projects.
- Let each account own one or more pipelines.
- Let users define pipeline variables as a simple key/value dictionary.
- Let users add ordered agents that run top-to-bottom.
- Let agents reference variables and prior agent outputs in prompts.
- Let agents write to title, excerpt, thumbnail prompt, or body.
- Concatenate body-targeted agent outputs into the final blog body.
- Save run outputs as local text/image assets.
- Optionally publish live runs to WordPress.
- Keep the UI direct, minimal, and YAGNI.

## Non-goals for MVP

- No canvas workflow builder.
- No branching UI.
- No loop builder.
- No multi-model marketplace.
- No agency billing system.
- No collaboration/commenting.
- No advanced analytics.
- No complex approval workflow.
- No multi-CMS support beyond WordPress.
- No public-facing website builder.

## MVP user outcome

A user can create an account, create a pipeline, define variables, add agents, generate a post, save output files, and optionally publish to WordPress.

## Core objects

- Account
- Pipeline
- Pipeline variable
- Agent
- Run
- Run asset
- Destination
- Publish attempt

## MVP pages

- Accounts page
- Account detail page
- Pipeline builder page

## Success criteria

- User can create, edit, and delete accounts.
- User can create a pipeline under an account.
- User can add/edit/delete variables and agents.
- User can run a pipeline using variable values.
- User can see generated title, excerpt, thumbnail prompt/image, and body.
- User can view saved assets for each run.
- User can see whether a run was dry or live.
- User can see WordPress post URL/status for live runs.

## Primary risks

- Prompt composition may become confusing if references are invisible.
- Users may expect complex n8n-like branching too early.
- WordPress auth can be brittle depending on hosting/security plugins.
- Generated images may add cost/latency; image generation should be optional.
- Scheduling should be simple and pausable to avoid accidental live posting.
