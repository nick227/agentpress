# AgentPress MVP Pre-Development Documentation

This folder contains the pre-development planning documents for the MVP.

## Product summary

AgentPress is a minimal account-based AI pipeline builder for generating blog posts and publishing/saving outputs. Accounts own pipelines. Pipelines contain setup, variables, ordered agents, and run history. Agents execute top-to-bottom. Each agent has a UID, system prompt, user prompt, and output target. Runs generate a structured post object: title, excerpt, thumbnail prompt/image, and body. Run assets are saved locally and optionally posted remotely.

## MVP pages

- `AccountsPage.tsx`
- `AccountDetailPage.tsx`
- `PipelineBuilderPage.tsx`

## Documentation index

1. Product Requirements / Scope
2. Personas and Target Audience
3. Site Map / Information Architecture
4. User Flows
5. Feature Prioritization
6. Technical Requirements / Stack
7. Data Model / Schema Outline
8. API Contracts / Shared Types
9. Authentication and Permissions
10. Third-Party Integrations
11. Wireframes / UI Specs
12. Design Brief / Brand Guide
13. Design System / Tokens
14. Component Library / UI Kit
15. Content Inventory
16. Development Handoff Checklist
17. Account-Level Schedules Proposal
18. Permissions, Visibility, Teams, and Community Plan

## Operational guides

- [Pipelines](pipelines.md) — agent chaining, output uses, **prompt reference conventions**
- [Research feeds](research-feeds.md) — feed types, slugs, sync, and summary prompts
