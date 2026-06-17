# Feature List and Prioritization

## MVP / Phase 1

### Accounts

- Create account
- Edit account
- Delete account
- List accounts
- Account owns pipelines

### Pipelines

- Create pipeline under account
- Edit pipeline name/description
- Delete pipeline
- View pipelines for account

### Pipeline setup

- Select destination
- Dry run checkbox
- Manual/recurring schedule fields
- Active/paused status

### Variables

- Add/edit/delete variables
- Fields: key, label, type, required, default value, example value
- Variables insertable into prompts as `{subject}`

### Agents

- Add/edit/delete/reorder agents
- Fields: UID, name, system prompt, user prompt, output target, output format
- Agent outputs referenceable as `{agents.researcher.output}`
- Agent types/output targets: Body, Title, Excerpt, Image Prompt

### Prompt tools

- Insert variable menu
- Insert previous agent output menu
- Inline AI Assist: draft/improve prompt with Apply/Cancel
- Basic validation for missing variables, duplicate UIDs, future agent references

### Runs

- Manual run
- Dry run/live mode
- Run history
- Run detail showing generated content first
- Agent output inspection
- Error display

### Generated post

- Title
- Excerpt
- Thumbnail prompt
- Thumbnail image if enabled/generated
- Body from concatenated body agents

### Outputs

- Save local run folder
- Save `post.md`
- Save `post.json`
- Save `thumbnail-prompt.txt`
- Save `thumbnail.png` if generated
- Save `publish-result.json` if posting attempted

### Integrations

- OpenAI for text/prompt assist/image generation
- WordPress REST API for publishing drafts/live posts

## Phase 2

- Destination CRUD as its own page
- Account-level destination management
- More schedule options
- Run presets
- Retry failed agent
- Rerun from selected agent
- Image upload to WordPress media library
- Generated thumbnail preview/edit
- Markdown/rich text editor
- Pipeline duplication
- Pipeline templates

## Phase 3

- Agent library
- Prompt library
- Pipeline versioning
- Multi-user roles
- Approval workflow
- Analytics
- Multi-CMS support
- Branching/conditional nodes
- Loop support
- Web research integrations
- SEO metadata tools
- Internal link suggestions

## Explicitly deferred

- n8n-style canvas
- Complex visual graph editor
- Marketplace
- Billing/subscriptions
- White-label client portal
