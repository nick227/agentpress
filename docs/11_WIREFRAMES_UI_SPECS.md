# Wireframes / UI Spec Descriptions

## AccountsPage

Purpose: list and manage accounts.

```txt
┌─────────────────────────────────────────────┐
│ Accounts                         + Account  │
├─────────────────────────────────────────────┤
│ Search/filter                                │
│                                             │
│ Client A        Category   3 pipelines Open │
│ Client B        Category   1 pipeline  Open │
│ Client C        Category   0 pipelines Open │
└─────────────────────────────────────────────┘
```

## AccountDetailPage

Purpose: show account details and owned pipelines.

```txt
┌─────────────────────────────────────────────┐
│ Client A                         Edit       │
│ Category · email · phone                    │
│ Description text                            │
├─────────────────────────────────────────────┤
│ Pipelines                         + Pipeline│
│                                             │
│ Blog Builder        active     5 agents     │
│ Product Posts       paused     3 agents     │
└─────────────────────────────────────────────┘
```

## PipelineBuilderPage

Purpose: build and run pipeline.

```txt
┌──────────────────────┬──────────────────────────────┐
│ Pipeline Sidebar      │ Main Detail Panel             │
│                      │                              │
│ Setup                │ Selected setup/variable/agent │
│                      │ or run detail                 │
│ Variables            │                              │
│ + Add variable        │                              │
│ - subject             │                              │
│ - tone                │                              │
│                      │                              │
│ Agents               │                              │
│ + Add agent           │                              │
│ 1. researcher         │                              │
│ 2. title_writer       │                              │
│ 3. body_writer        │                              │
│                      │                              │
│ Runs                 │                              │
│ - latest run          │                              │
└──────────────────────┴──────────────────────────────┘
```

## Setup detail

```txt
Pipeline Setup

Destination
[ Select destination ]

Mode
[ ] Dry run only

Schedule
[ Manual / Recurring ]
[ Daily / Weekly / Monthly ] [ Time ] [ Timezone ]

Status
[ Paused / Active ]

[ Save ] [ Run now ]
```

## Variable detail

```txt
Variable

Key            [ subject ]
Label          [ Subject ]
Type           [ text ]
Required       [x]
Default value  [        ]
Example value  [        ]

[ Save ] [ Delete ]
```

## Agent detail

```txt
Agent

UID            [ researcher ]
Name           [ Researcher ]
Output target  [ Body ]
Output format  [ Markdown ]

System Prompt
[ Insert variable ] [ Insert agent output ] [ AI Assist ]
[ textarea/code editor ]

User Prompt
[ Insert variable ] [ Insert agent output ] [ AI Assist ]
[ textarea/code editor ]

[ Save ] [ Test Agent ] [ Delete ]
```

## Run detail: content first

```txt
Generated Post

Title
[ generated title ]

Thumbnail
[ thumbnail image or prompt ]

Excerpt
[ generated excerpt ]

Body
[ generated blog body ]

Assets
post.md  post.json  thumbnail-prompt.txt  thumbnail.png

Publishing
Mode: Dry run / Live
Destination: WordPress Site
Status: Draft created / Published / Failed
URL: ...
```

## Visual principle

The builder is a column plus a detail panel. No canvas. No graph. No heavy navigation.
