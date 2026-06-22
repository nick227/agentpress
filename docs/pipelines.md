# AgentPress Pipelines

Pipelines in AgentPress form the core engine for generating content. A pipeline chains multiple AI agents together in a specific order, passing information between them and combining their outputs into a cohesive final post. 

## What is a Pipeline?
A pipeline is an ordered sequence of **Agents**. Each pipeline belongs to an Account and can optionally be connected to a Destination (like WordPress) for publishing. When a pipeline is executed, it runs each agent in sequence, gathering research, generating text or images, and finally assembling everything into a completed asset.

## Agents
An agent is a single step within a pipeline. Each agent is responsible for executing a specific prompt and producing a result.

### Agent Configuration
Each agent has:
- **System Prompt:** Defines the persona, constraints, and rules for the agent (e.g., "You are an expert financial analyst.").
- **User Prompt:** The actual task or request the agent should fulfill (e.g., "Summarize the following transcript: {ziptrader.content}").
- **Output Use:** Determines how the agent's output is utilized in the final post assembly.

## Output Uses and Final Assembly
Every agent produces an output that is saved to the pipeline run. You can configure what happens to that output:

*   **Not included in final post:** The output is saved and can be referenced by later agents, but won't directly appear in the published post. Useful for intermediate research or reasoning steps.
*   **Title:** Sets the final post title. If multiple agents output a title, the latest one in the pipeline wins.
*   **Body:** Content is added to the final post body. You can use the Body Composer to arrange and reorder multiple body blocks without having to rerun the AI.
*   **Excerpt:** Sets the final post excerpt. The latest one wins.
*   **Image:** Generates an inline image, embedding it into the body as a figure block with an `<img>` tag.
*   **Thumbnail Prompt:** Sets the prompt used to generate the main featured image (thumbnail). The latest one wins.

## Variables and References

You can pass data into agent prompts using `{references}`. References are evaluated dynamically when the pipeline runs. All resolved variables and research feeds are locked in at run start, so prompt rendering is reproducible for that run.

## Prompt Reference Conventions

References use curly braces: `{root}` or `{root.field}`. The **root** determines what kind of value is resolved.

### Taxonomy

| Syntax | Resolves as | Example |
|---|---|---|
| `{outline.output}` | Prior pipeline node output | Full text from the agent whose UID is `outline` |
| `{writer.body}` | Prior node shaped field | Same output, keyed by that agent's output target (`body`, `title`, `excerpt`, etc.) |
| `{ziptrader.summary}` | Research feed / resource | Latest summary for feed slug `ziptrader` |
| `{context}` | Pipeline variable | Variable defined on the pipeline or injected by a loop |
| `{row.title}` | Dataset row field | Field from the current row when running over a dataset |

Use the **agent UID** as the root for prior steps — not an `agents.` prefix:

```
{outline.output}
{outline.title}
{writer.body}
```

Not:

```
{agents.outline.output}   ← legacy only
```

### Resolution order

For dotted references `{root.field}`, the renderer resolves the root in this order:

1. **Pipeline node UID** — output from a prior agent in this run
2. **Feed / resource key** — workspace research feed, then community feed
3. **Variable or row path** — pipeline variables, loop injection, dataset fields
4. **Missing** — reference is left unchanged; validation warns

Pipeline node UIDs must not collide with feed slugs used in the same pipeline. Save-time validation flags collisions.

### Prior node outputs

Each completed agent exposes its output under its UID:

- `{uid.output}` — always the agent's raw output text
- `{uid.body}`, `{uid.title}`, `{uid.excerpt}`, … — same text, keyed by that agent's **Output Use** setting

Example: if agent `outline` runs before agent `writer`, the writer prompt can include:

```
Refine this outline into a full post:

{outline.output}
```

If `outline` has Output Use set to **Body**, `{outline.body}` resolves to the same value.

### Research feed references

Inject stored research using the feed **slug** as the root:

| Field | Meaning |
|---|---|
| `{slug.summary}` | Latest item, summarized with the feed's summary style |
| `{slug.date}` | Publish date (`YYYY-MM-DD`) |
| `{slug.title}` | Title of the source item |
| `{slug.url}` | URL of the source item |
| `{slug.content}` | Full collected content or transcript |

Example:

```
Summarize today's market context:

{ziptrader.summary}
```

**Pin a specific day** for exact reuse:

```
{wallstreetbets.2026-06-18.summary}
{wallstreetbets.2026-06-18.title}
```

Date-pinned refs use the same summary style as `{slug.summary}`.

### Pipeline variables

Simple `{key}` references resolve to pipeline variables defined in the builder (e.g. `{topic}`, `{audience}`, `{tone}`).

Loop and dataset runs may inject additional keys (e.g. `{context}` maps from a loop variable, `{row.title}` from the current dataset row).

### Legacy syntax

Older pipelines may still use `{agents.uid.output}`. This still resolves (normalized to `{uid.output}`) but is deprecated. The builder insert menu and new templates use `{uid.output}` only.

Similarly, `{research.summary}` is legacy — use `{feed_slug.summary}` instead.

### Validation

At pipeline save and seed time, references are checked against known agent UIDs, feed slugs, and variable keys. Unknown feeds error; unknown node UIDs warn; legacy `agents.` prefixes warn.

## Pipeline Runs
When you execute a pipeline, it generates a **Run**. 
- Runs happen asynchronously. You can start a run and check its status (`running`, `completed`, `failed`, `posted`).
- All resolved variables and research feeds are locked in at the moment the run starts, making the prompt rendering reproducible.
- You can perform a **Dry Run**, which executes the AI agents and saves outputs locally, but will **not** publish to your WordPress destination.

### Run Assets
All outputs are saved locally on your filesystem (defaulting to `./outputs`). This includes the final Markdown post, individual agent outputs (`agent-outputs.json`), thumbnail prompts, and downloaded images.

## Agent Output Reuse (Caching)
AgentPress is designed to be fast and cost-effective. By default, it **reuses unchanged agent outputs**.
If an agent's rendered inputs (System Prompt + User Prompt with all variables resolved), model, and format have *not* changed since a previous completed run, AgentPress will reuse the previous result instead of making a new API call to OpenAI.

In the run view, each agent is labeled as:
- **Generated:** The AI was actively called for this agent in this run.
- **Reused:** The output was reused from a prior run with matching inputs.
- **Failed:** The agent encountered an error.

*Note: If you change an upstream dependency—such as updating a `{topic}` or if `{outline.output}` changes—the rendered prompt downstream changes automatically. This forces downstream agents to regenerate while keeping unaffected upstream agents cached.*

## Publishing Destinations
Once a pipeline has finished generating its outputs and assembling the final post, it can be published.
- Destinations (like WordPress via REST API and Application Passwords) are configured at the Account level.
- Assign a Destination in the pipeline's **Setup** tab.
- WordPress destinations default to saving posts as drafts unless explicitly configured to publish directly. Images generated in the body or as thumbnails are uploaded to the WordPress Media Library, and paths are rewritten automatically.
