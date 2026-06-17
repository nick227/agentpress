# Information Architecture / Site Map

## MVP route map

```txt
/accounts
/accounts/:accountId
/accounts/:accountId/pipelines/:pipelineId
```

## Page: AccountsPage

Purpose: manage accounts.

Contains:

- Account list
- New account action
- Edit/delete actions
- Basic account metadata
- Pipeline count

## Page: AccountDetailPage

Purpose: view one account and its pipelines.

Contains:

- Account header
- Account details
- Edit account action
- Pipeline list
- New pipeline action
- Open pipeline action

## Page: PipelineBuilderPage

Purpose: build, configure, run, and inspect a pipeline.

Left sidebar sections:

- Setup
- Variables
- Agents
- Runs

Main detail panel states:

- Setup editor
- Variable editor
- Agent editor
- Run viewer

## Navigation hierarchy

```txt
Accounts
  Account Detail
    Pipeline Builder
      Setup
      Variables
      Agents
      Runs
```

## MVP navigation behavior

- User starts at Accounts.
- Selecting an account opens account detail.
- Selecting a pipeline opens the builder.
- Pipeline builder stays in one screen and swaps main detail views based on sidebar selection.

## Future IA additions

- Destinations page
- Global prompt library
- Global agent templates
- Settings
- Billing
- Team/users
- Account-level analytics
