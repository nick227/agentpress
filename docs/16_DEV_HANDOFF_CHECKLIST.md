# Development Handoff Checklist

## Product scope confirmed

- [ ] Accounts own pipelines.
- [ ] Pipelines have setup, variables, agents, and runs.
- [ ] Agents run top-to-bottom.
- [ ] Agents have UID, system prompt, user prompt.
- [ ] Agents can reference variables and previous outputs.
- [ ] Generated run output is a post object.
- [ ] Post contains title, excerpt, thumbnail prompt/image, body.
- [ ] Body is concatenated from Body agents in order.
- [ ] Output files are saved locally.
- [ ] WordPress posting is optional and controlled by dry run/live mode.

## MVP pages

- [ ] AccountsPage.tsx
- [ ] AccountDetailPage.tsx
- [ ] PipelineBuilderPage.tsx

## Core frontend components

- [ ] AccountList
- [ ] AccountForm
- [ ] PipelineList
- [ ] PipelineRow
- [ ] BuilderShell
- [ ] BuilderSidebar
- [ ] DetailPanel
- [ ] BuilderSetup
- [ ] BuilderVariable
- [ ] BuilderAgent
- [ ] BuilderRun
- [ ] PromptField
- [ ] InsertReferenceMenu
- [ ] PromptAssist

## Backend services

- [ ] AccountService
- [ ] PipelineService
- [ ] PipelineRunService
- [ ] PromptRenderService
- [ ] OpenAIService
- [ ] OutputAssetService
- [ ] WordPressService

## Critical validation

- [ ] Duplicate account/pipeline names handled.
- [ ] Duplicate variable keys blocked.
- [ ] Duplicate agent UIDs blocked.
- [ ] Future agent references blocked.
- [ ] Missing variable references surfaced.
- [ ] Dry run cannot post remotely.
- [ ] Paused scheduled pipeline cannot run automatically.

## Run output files

- [ ] post.md
- [ ] post.json
- [ ] thumbnail-prompt.txt
- [ ] thumbnail.png if generated
- [ ] publish-result.json if attempted
- [ ] agent-outputs.json

## Recommended first implementation sequence

1. Static UI shell with mock data.
2. Account CRUD.
3. Pipeline CRUD under accounts.
4. Builder sidebar/details with local state.
5. Variable/agent editing.
6. Prompt reference insertion/validation.
7. Manual pipeline run using OpenAI.
8. GeneratedPost assembly.
9. Output folder asset saving.
10. Run detail view.
11. WordPress draft publishing.
12. Scheduling/pause controls.
