# Content Inventory

## App navigation copy

- Accounts
- Pipelines
- Setup
- Variables
- Agents
- Runs

## Core actions

- New Account
- New Pipeline
- Add variable
- Add agent
- Run now
- Run test
- Save
- Delete
- Duplicate
- Pause
- Start
- Copy output
- Open posted URL
- Download asset

## Empty states

### No accounts

Title: No accounts yet
Body: Create an account to group pipelines by client, brand, site, or project.
CTA: New Account

### No pipelines

Title: No pipelines yet
Body: Add a pipeline to generate posts for this account.
CTA: New Pipeline

### No variables

Title: No variables
Body: Add optional input keys that agents can reference in prompts.
CTA: Add variable

### No agents

Title: No agents
Body: Add agents that run top-to-bottom and write parts of the post.
CTA: Add agent

### No runs

Title: No runs yet
Body: Run the pipeline to generate content and save output assets.
CTA: Run now

## Field labels

### Account

- Name
- Category
- Phone
- Email
- Description

### Pipeline setup

- Destination
- Dry run only
- Schedule mode
- Frequency
- Time
- Timezone
- Status

### Variable

- Key
- Label
- Type
- Required
- Default value
- Example value

### Agent

- UID
- Name
- Output target
- Output format
- System prompt
- User prompt

### Run

- Generated Post
- Title
- Thumbnail
- Excerpt
- Body
- Assets
- Publishing
- Agent outputs

## Validation messages

- Variable key is required.
- Variable key must be unique.
- Agent UID is required.
- Agent UID must be unique.
- System prompt is required.
- User prompt is required.
- Reference does not exist.
- Agent references a future agent.
- Dry run is enabled. This run will not post remotely.
- Live mode is enabled. This run may post to the selected destination.

## Assets needed

MVP can ship without custom brand assets.

Optional assets:

- Wordmark SVG
- Favicon
- Default thumbnail placeholder
- Empty-state icon set
- App icon
