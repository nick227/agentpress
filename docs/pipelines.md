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
You can pass data into your agent prompts using `{variables}`. These are evaluated dynamically when the pipeline runs.

### General Variables
*   `{topic}`: The main subject for the pipeline run.
*   `{agents.[uid].output}`: The exact output of a previous agent in the pipeline. This is crucial for chaining agents together (e.g., Agent B refines the output of Agent A).

### Research References
If you have connected Research Sources (like YouTube transcripts, Reddit daily digests, or RSS feeds), you can inject their stored data into prompts using their source slug.
*   `{source_slug.summary}`: The latest stored summary (e.g., `{ziptrader.summary}`).
*   `{source_slug.date}`: Publish date (YYYY-MM-DD).
*   `{source_slug.title}`: The title of the source item.
*   `{source_slug.url}`: The URL of the source item.
*   `{source_slug.content}`: Full collected content or transcript.
*   `{research.summary}`: A default summary for the pipeline.

*Tip: For exact reuse of a prior daily pull, you can pin a specific day's research by using `{source_slug.YYYY-MM-DD.summary}` (e.g., `{wallstreetbets.2026-06-18.title}`).*

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

*Note: If you change an upstream dependency—such as updating a `{topic}` or if `{agents.previous.output}` changes—the rendered prompt downstream changes automatically. This forces downstream agents to regenerate while keeping unaffected upstream agents cached.*

## Publishing Destinations
Once a pipeline has finished generating its outputs and assembling the final post, it can be published.
- Destinations (like WordPress via REST API and Application Passwords) are configured at the Account level.
- Assign a Destination in the pipeline's **Setup** tab.
- WordPress destinations default to saving posts as drafts unless explicitly configured to publish directly. Images generated in the body or as thumbnails are uploaded to the WordPress Media Library, and paths are rewritten automatically.
