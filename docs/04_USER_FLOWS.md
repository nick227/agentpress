# User Flow Diagrams

## Flow 1: Create account

```txt
AccountsPage
  → Click New Account
  → Fill name, category, phone, email, description
  → Save
  → AccountDetailPage
```

## Flow 2: Create pipeline

```txt
AccountDetailPage
  → Click New Pipeline
  → Enter pipeline name/description
  → PipelineBuilderPage
  → Setup selected by default
```

## Flow 3: Configure pipeline setup

```txt
PipelineBuilderPage
  → Click Setup
  → Select destination
  → Toggle Dry Run on/off
  → Choose Manual or Recurring
  → Set frequency/time/timezone if recurring
  → Pause or Start pipeline
  → Save
```

## Flow 4: Add variables

```txt
PipelineBuilderPage
  → Click Add Variable
  → Enter key, label, type, required, default/example values
  → Save
  → Variable appears in sidebar
  → Variable becomes insertable in agent prompts as {key}
```

## Flow 5: Add agent

```txt
PipelineBuilderPage
  → Click Add Agent
  → Enter UID and name
  → Choose output target: Body, Title, Excerpt, Image Prompt
  → Write system prompt
  → Write user prompt
  → Insert variables or prior agent outputs
  → Save
  → Agent appears in ordered list
```

## Flow 6: Use inline AI prompt helper

```txt
AgentEditor
  → Click AI Assist near prompt field
  → Enter short human instruction: “write a prompt for a research agent”
  → Generate suggestion
  → Review suggested prompt
  → Apply or Cancel
```

## Flow 7: Run pipeline manually

```txt
PipelineBuilderPage
  → Click Run Test or Run Now
  → Fill variable values
  → Confirm dry/live mode
  → Agents execute top-to-bottom
  → GeneratedPost assembled
  → Output assets saved locally
  → If live, publish to WordPress
  → New run appears in Runs section
```

## Flow 8: View run result

```txt
PipelineBuilderPage
  → Click run in Runs section
  → Main panel shows generated content first
  → Review title, thumbnail, excerpt, body
  → View saved assets
  → View publish status/post URL
  → Optionally inspect agent outputs
```

## Flow 9: Scheduled pipeline run

```txt
Pipeline status is Active
  → Schedule trigger fires
  → Pipeline runs using configured/default variables or preset values
  → Assets saved
  → If Dry Run off, post remotely
  → Run history updated
```

MVP scheduling can be implemented after manual runs if needed.
