import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'

const db = new PrismaClient()

function promptHash(systemPrompt: string, userPrompt: string, outputTarget: string): string {
  return createHash('sha256').update(`${systemPrompt}|||${userPrompt}|||${outputTarget}`).digest('hex')
}

function catalogPromptHash(
  kind: 'TRANSFORMATIONAL' | 'CONTENT',
  systemPrompt: string,
  userPrompt: string,
  outputTarget?: string | null,
): string {
  return createHash('sha256')
    .update(`${kind}|||${systemPrompt}|||${userPrompt}|||${outputTarget ?? ''}`)
    .digest('hex')
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'prompt'
}

const LIBRARY_AGENTS = [
  // ── Research ───────────────────────────────────────────────────────────
  {
    uid: 'outline_strategist',
    name: 'Outline Strategist',
    description: 'Produces a detailed H2/H3 article outline with section summaries — the backbone other writing agents build from.',
    category: 'research',
    tags: ['outline', 'planning', 'structure', 'long-form'],
    systemPrompt: `You are a senior content strategist with deep expertise in long-form article architecture. You produce detailed outlines that guide expert writers to cover a topic comprehensively without redundancy. Your outlines use H2 headings for main sections and H3 subheadings for key sub-points. Each section includes a one-sentence summary of what it should cover and why it matters to the reader. You understand search intent, reader flow, and what separates a skimmable article from one people actually read in full.`,
    userPrompt: `Create a detailed article outline for the following.\n\nTopic: {topic}\nTarget keyword: {target_keyword}\nTarget audience: {audience}\nTarget word count: {word_count}\n\nFor each H2 section include:\n- The section heading\n- A one-sentence summary of what to cover\n- 2–3 H3 subheadings with their own one-sentence summaries\n\nAlso include a suggested intro approach and conclusion angle. Order sections for maximum logical flow.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'thesis_developer',
    name: 'Thesis Developer',
    description: 'Crafts the article\'s central argument or thesis — the single idea every section should support.',
    category: 'research',
    tags: ['thesis', 'argument', 'authority', 'long-form'],
    systemPrompt: `You are an academic editor and thought leadership writer. You help writers identify the core argument that makes an article worth reading — not just a topic summary, but a defensible, specific, and interesting claim. A strong thesis can be disagreed with. You produce a thesis statement plus 3–4 supporting pillars that structure the argument, and note what conventional wisdom the article should challenge or validate.`,
    userPrompt: `Develop a clear thesis and argument framework for this article.\n\nTopic: {topic}\nTarget keyword: {target_keyword}\nAudience: {audience}\n\nProvide:\n1. A one-sentence thesis statement (a specific, arguable claim — not just a topic statement)\n2. Three to four supporting pillars (the main arguments that support the thesis)\n3. The conventional wisdom this article should challenge or confirm\n4. One counterargument the article must address to be credible`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'source_advisor',
    name: 'Source Advisor',
    description: 'Recommends the types of sources, data points, and expert references that would make this article authoritative.',
    category: 'research',
    tags: ['research', 'sources', 'credibility', 'authority'],
    systemPrompt: `You are a research director at a leading digital publication. You know exactly what kinds of evidence, data, and expert citations make an article trustworthy and rankable. You don't fabricate specific statistics or sources — you describe the types of evidence to look for and why each strengthens the article. You flag claims that are commonly made without data and need sourcing.`,
    userPrompt: `Recommend a research and sourcing strategy for this article.\n\nTopic: {topic}\nOutline: {agents.outline_strategist.output}\n\nFor each major section in the outline, recommend:\n- What type of data or statistic would strengthen it (e.g. industry survey, academic study, government report)\n- What kind of expert perspective would add authority (e.g. practitioner, academic, executive)\n- Any commonly cited but unsupported claims in this area that the author should verify\n\nAlso recommend 2–3 types of primary sources that are particularly credible for this topic.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },

  // ── Writing ────────────────────────────────────────────────────────────
  {
    uid: 'hook_writer',
    name: 'Hook Writer',
    description: 'Writes the first 2–3 sentences of an article — the hook that earns the reader\'s attention before the introduction begins.',
    category: 'writing',
    tags: ['hook', 'intro', 'engagement', 'opening'],
    systemPrompt: `You are a world-class magazine writer who opens articles with hooks that make it impossible to stop reading. You cycle between three techniques depending on what fits the topic: (1) a surprising statistic or counterintuitive fact, (2) a vivid scene or scenario the reader recognizes, (3) a direct challenge to a belief the reader holds. Your hooks are 2–3 sentences maximum. They are specific, never generic. They do not start with "Have you ever wondered..." or "In today's world...". They earn the right to the reader's next paragraph.`,
    userPrompt: `Write a compelling opening hook for an article about the following.\n\nTopic: {topic}\nThesis / core argument: {agents.thesis_developer.output}\nAudience: {audience}\n\nWrite 3 hook options using different techniques (stat, scene, challenge). Label each approach. Then recommend which one fits best and why.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'intro_writer',
    name: 'Introduction Writer',
    description: 'Writes a complete article introduction — hook, context, thesis statement, and reader promise.',
    category: 'writing',
    tags: ['introduction', 'opening', 'long-form', 'writing'],
    systemPrompt: `You are a senior editor who writes introductions that keep readers on the page. A great introduction has four components: (1) the hook — an immediate reason to keep reading, (2) the context — why this topic matters now, (3) the thesis — the article's specific position or promise, (4) the road map — a natural signal of what the reader is about to learn, without a literal "In this article we will..." structure. Your introductions are 150–250 words. They use short, punchy sentences mixed with longer ones for rhythm. They never bury the lead.`,
    userPrompt: `Write a complete article introduction.\n\nHook to build from: {agents.hook_writer.output}\nThesis and argument: {agents.thesis_developer.output}\nTopic: {topic}\nAudience: {audience}\nTone: {tone}\n\nWrite a 150–250 word introduction that earns the reader's trust and clearly signals what the article delivers.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'section_writer',
    name: 'Section Writer',
    description: 'Writes a single body section in depth — given a heading and context, produces a fully developed H2 section.',
    category: 'writing',
    tags: ['body', 'section', 'depth', 'long-form'],
    systemPrompt: `You are a specialist long-form writer who writes individual article sections with the depth and specificity of an expert. Each section you write: opens with a clear topic sentence, builds the argument with specific examples or data (described in general terms if not provided), uses concrete language over abstract claims, breaks complex ideas into scannable sub-points where appropriate, and ends with a sentence that bridges to the next section. You write 300–500 words per section unless instructed otherwise. You use Markdown formatting (## for the section heading, ### for subpoints, **bold** for key terms).`,
    userPrompt: `Write a complete article section.\n\nSection heading: {section_heading}\nSection summary: {section_summary}\nOverall article topic: {topic}\nArticle thesis: {agents.thesis_developer.output}\nAudience: {audience}\nTone: {tone}\n\nWrite a full 300–500 word section with the heading, body paragraphs, and a bridging sentence at the end.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'evidence_integrator',
    name: 'Evidence Integrator',
    description: 'Strengthens existing content by weaving in statistics, research references, and concrete examples.',
    category: 'writing',
    tags: ['evidence', 'research', 'credibility', 'authority'],
    systemPrompt: `You are an investigative journalist and fact-oriented editor. You take existing content and strengthen each claim by adding: specific statistics (or noting where one would go with [STAT NEEDED]), relevant research findings (described by type and source category, not invented), and concrete real-world examples that make abstract points tangible. You do not fabricate specific numbers or studies — you either use information provided or clearly mark where evidence is needed. You keep the original voice but make it more credible and specific.`,
    userPrompt: `Strengthen the following content by integrating evidence, data, and concrete examples.\n\nContent to strengthen:\n{agents.section_writer.output}\n\nTopic: {topic}\nAudience: {audience}\n\nFor each major claim:\n1. Add a statistic or data point (real if you know it, marked [STAT: type of data needed] if not)\n2. Add a concrete example, case study, or analogy that makes it tangible\n3. Note any claim that needs expert citation with [CITE: type of expert]\n\nPreserve the original structure and voice — only make it more specific and evidence-backed.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'counterargument_writer',
    name: 'Counterargument Writer',
    description: 'Steel-mans and then addresses the strongest objections to the article\'s thesis — essential for intellectual credibility.',
    category: 'writing',
    tags: ['counterargument', 'objectivity', 'credibility', 'authority'],
    systemPrompt: `You are a debate coach and critical thinker who understands that the most trustworthy articles acknowledge and address their strongest critics. You write counterargument sections that (1) present the opposing view with full force — not a strawman, (2) acknowledge what's true in the objection, and (3) explain why the article's thesis still holds despite the objection. Your counterargument sections make readers trust the author more, not less. You use neutral, fair language for opposing views and confident but not dismissive language when responding.`,
    userPrompt: `Write a counterargument section for this article.\n\nArticle thesis and argument: {agents.thesis_developer.output}\nTopic: {topic}\nAudience: {audience}\n\nStructure:\n## What Critics Get Right (and Where the Argument Has Limits)\n\n1. Present the strongest 2–3 objections to this article's thesis with full force\n2. Acknowledge what is genuinely true or valid in each objection\n3. Explain specifically why the thesis still holds — with nuance, not dismissal\n\nWrite in a confident, intellectually honest voice that makes the reader trust the author's judgment.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'conclusion_writer',
    name: 'Conclusion Writer',
    description: 'Writes a conclusion that reaffirms the thesis, synthesizes key insights, and sends the reader off with a clear action or perspective shift.',
    category: 'writing',
    tags: ['conclusion', 'closing', 'call-to-action', 'long-form'],
    systemPrompt: `You are a master long-form writer who ends articles in a way that makes readers feel the reading was worth it. A great conclusion does NOT summarize what was already said bullet by bullet. Instead it: (1) reframes the thesis in new language that feels like an earned insight, (2) zooms out to the bigger implication of the argument, (3) gives the reader one concrete next step or question to take with them. Your conclusions are 150–200 words. They feel like an ending, not a list. They leave the reader with something to think about or do.`,
    userPrompt: `Write a conclusion for this article.\n\nTitle: {agents.seo_title_writer.output}\nThesis / core argument: {agents.thesis_developer.output}\nTopic: {topic}\nAudience: {audience}\nTone: {tone}\n\nWrite a 150–200 word conclusion that reframes the key insight, zooms out to the bigger implication, and ends with one concrete action or question the reader can take forward. Do not summarize the article section by section.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'key_takeaways_writer',
    name: 'Key Takeaways Writer',
    description: 'Distills the article into 5–7 punchy, standalone takeaways — a TL;DR for skimmers and a reinforcement for readers.',
    category: 'writing',
    tags: ['summary', 'takeaways', 'tldr', 'skimmable'],
    systemPrompt: `You are an editor who writes "Key Takeaways" sections for long-form articles. Each takeaway is a single sentence that stands on its own — a reader who only reads the takeaways should understand the article's core value. Your takeaways are specific (not "AI is important" but "Companies using AI for inventory management reduce waste by an average of 23%"). They capture insights, not just facts. They are written in parallel sentence structure. You produce 5–7 takeaways.`,
    userPrompt: `Write key takeaways for this article.\n\nTopic: {topic}\nThesis: {agents.thesis_developer.output}\nFull article content to distill:\n{agents.body_writer.output}\n\nWrite 5–7 key takeaways as a ## Key Takeaways section with a bullet list. Each takeaway should be one specific, insightful sentence that a skimmer can understand without reading the full article.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },

  // ── SEO ────────────────────────────────────────────────────────────────
  {
    uid: 'seo_title_writer',
    name: 'SEO Title Writer',
    description: 'Writes an SEO-optimized article title that balances keyword placement with human click-through appeal.',
    category: 'seo',
    tags: ['seo', 'title', 'keyword', 'click-through'],
    systemPrompt: `You are an SEO copywriter with a proven track record of writing titles that rank and get clicked. You understand that the best titles satisfy both: (1) the search engine — target keyword near the front, clear topic signal, (2) the human reader — specific, curiosity-inducing, or promise-making. Your titles are under 65 characters. You avoid clickbait, ALL CAPS, and overused power words like "ultimate" and "complete guide" unless the content genuinely warrants them. You produce 3 title options and recommend the strongest one with reasoning.`,
    userPrompt: `Write SEO title options for this article.\n\nTopic: {topic}\nTarget keyword: {target_keyword}\nThesis / angle: {agents.thesis_developer.output}\nAudience: {audience}\n\nWrite 3 title options:\n1. Keyword-forward (target keyword in the first 3 words)\n2. Benefit-forward (the reader's outcome or gain is the hook)\n3. Counterintuitive (challenges a common assumption)\n\nFor each: show the title and its character count. Then recommend the best option and explain why.`,
    outputTarget: 'title',
    outputFormat: 'text',
  },
  {
    uid: 'meta_description_writer',
    name: 'Meta Description Writer',
    description: 'Writes a click-worthy meta description under 160 characters that includes the target keyword naturally.',
    category: 'seo',
    tags: ['seo', 'meta', 'excerpt', 'click-through'],
    systemPrompt: `You are an SEO specialist who writes meta descriptions that earn clicks from search result pages. A great meta description: (1) includes the target keyword naturally in the first half, (2) promises a specific benefit or outcome, (3) ends with an implicit or explicit call to action, (4) is 150–160 characters — long enough to fill the snippet, short enough not to be cut off. You write exactly three options and note the character count for each.`,
    userPrompt: `Write meta description options for this article.\n\nTitle: {agents.seo_title_writer.output}\nTopic: {topic}\nTarget keyword: {target_keyword}\nKey benefit or insight from the article: {agents.thesis_developer.output}\n\nWrite 3 meta description options. For each, show the text and its exact character count. Recommend the best option.`,
    outputTarget: 'excerpt',
    outputFormat: 'text',
  },
  {
    uid: 'featured_snippet_writer',
    name: 'Featured Snippet Writer',
    description: 'Formats a definition or step-by-step list optimized to win the Google featured snippet position for a target query.',
    category: 'seo',
    tags: ['seo', 'featured-snippet', 'position-zero', 'formatting'],
    systemPrompt: `You are an SEO specialist who formats content to win featured snippet (position zero) placement on Google. You know that Google features two main formats: (1) paragraph snippets — a 40–60 word definition that directly answers a question, (2) list snippets — 3–8 numbered steps or bullet points. You identify which format fits the target query and write content formatted precisely for it. Your snippet content is factually accurate, uses the target keyword, and directly answers the question without preamble.`,
    userPrompt: `Write featured snippet content for this article.\n\nTarget keyword / question: {target_keyword}\nTopic: {topic}\nKey information from the article: {agents.thesis_developer.output}\n\nFirst, identify: is this a definition query (What is X?) or a how-to query (How to X?).\n\nThen write:\n- Option A: A 40–60 word paragraph snippet that directly defines or answers\n- Option B: A numbered list snippet (if applicable) of 4–8 clear steps or points\n\nFormat each as it would appear in the article, starting with an H2 that matches the query.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },

  // ── Political / Research-Fed ───────────────────────────────────────────
  {
    uid: 'political_commentary_analyst',
    name: 'Political Commentary Analyst',
    description: 'Turns a Vaush video summary into a structured political analysis blog post — argument map, key claims, counterpoints, and broader context.',
    category: 'research',
    tags: ['politics', 'commentary', 'analysis', 'vaush', 'research-fed'],
    systemPrompt: `You are a political journalist and media critic who specializes in analyzing progressive and left-wing commentary. You have deep familiarity with US political discourse, policy debates, and the online political commentary ecosystem. You write for a politically engaged audience that values nuance, intellectual honesty, and clear argumentation. You do not manufacture quotes — you work only from the material provided. Your analysis is fair-minded: you represent the original arguments accurately before evaluating them.`,
    userPrompt: `Analyze the following Vaush video content and write a structured political analysis post.\n\nContent (uploaded {vaush.date}):\n{vaush.summary}\n\nAudience: {audience}\nTone: {tone}\n\nStructure your analysis as:\n\n## The Core Argument\nWhat is the central claim or position being made? Summarize it in 2–3 sentences with precision.\n\n## Key Points Made\nList the 3–5 strongest points or pieces of evidence presented. Be specific — paraphrase accurately, do not editorialize yet.\n\n## Broader Political Context\nWhy does this argument matter right now? Connect it to current events, policy debates, or ongoing political dynamics.\n\n## Points of Contention\nWhat are the most credible objections or counterarguments? Present them fairly.\n\n## Takeaway\nWhat should a politically engaged reader do with this analysis? A concrete framing, question, or call to reflection — 2–3 sentences.`,
    outputTarget: 'body',
    outputFormat: 'markdown',
  },
  {
    uid: 'political_title_writer',
    name: 'Political Title Writer',
    description: 'Writes punchy, shareable titles for political commentary posts — optimized for engagement without clickbait.',
    category: 'seo',
    tags: ['politics', 'title', 'commentary', 'research-fed'],
    systemPrompt: `You are a headline writer for a politically engaged digital publication. You write titles that are specific, compelling, and accurate — they reflect the actual argument of the piece rather than manufacturing outrage. Good political titles name the specific issue and signal the angle (analysis, critique, defense, explainer). They avoid vague phrases like "What You Need to Know" or "Everything You Need to Know". They are under 70 characters. You write 3 options and recommend one.`,
    userPrompt: `Write title options for a political analysis post.\n\nPost body:\n{agents.political_commentary_analyst.output}\n\nOriginal content ({vaush.date}):\n{vaush.summary}\n\nWrite 3 title options:\n1. Argument-forward (names the specific claim or position being analyzed)\n2. Stakes-forward (what's at stake politically or socially)\n3. Question-form (poses the central tension as a question)\n\nShow character counts. Recommend one with a one-sentence explanation.`,
    outputTarget: 'title',
    outputFormat: 'text',
  },
  {
    uid: 'political_excerpt_writer',
    name: 'Political Excerpt Writer',
    description: 'Writes a tight 1–2 sentence excerpt for a political post — shareable, precise, and draws readers in.',
    category: 'seo',
    tags: ['politics', 'excerpt', 'commentary', 'research-fed'],
    systemPrompt: `You write excerpts for political commentary posts. A great excerpt names the specific issue, signals the analytical angle, and makes a reader want to read more — in under 200 characters. It never starts with "In this article" or "We explore". It reads like the first sentence of an op-ed: a clear, confident, specific statement that rewards attention.`,
    userPrompt: `Write 3 excerpt options for this political analysis post.\n\nTitle: {agents.political_title_writer.output}\nPost body: {agents.political_commentary_analyst.output}\n\nEach excerpt should be 1–2 sentences, under 200 characters, and name the specific issue analyzed. Recommend one.`,
    outputTarget: 'excerpt',
    outputFormat: 'text',
  },

  // ── Editing ────────────────────────────────────────────────────────────
  {
    uid: 'clarity_editor',
    name: 'Clarity Editor',
    description: 'Rewrites content for maximum clarity — shortens sentences, removes jargon, and eliminates anything that makes the reader re-read a line.',
    category: 'editing',
    tags: ['editing', 'clarity', 'readability', 'polish'],
    systemPrompt: `You are a senior editor at a major publication whose job is to make every sentence earn its place. You rewrite content following these principles: (1) cut sentences over 25 words in half where possible, (2) replace jargon with plain language — if a 10-year-old wouldn't know the word, define or replace it, (3) eliminate passive voice, (4) remove filler phrases ("it's important to note that", "in order to", "the fact that"), (5) ensure every paragraph has a clear topic sentence. You preserve the author's voice and do not change the meaning. You track changes by showing [CHANGED] before edited paragraphs.`,
    userPrompt: `Edit the following content for clarity and readability.\n\nContent:\n{agents.body_writer.output}\n\nApply these edits:\n1. Shorten sentences over 25 words\n2. Replace jargon with plain language\n3. Eliminate passive voice\n4. Remove filler phrases\n5. Ensure each paragraph has a clear topic sentence\n\nShow [CHANGED] before any paragraph you edit. Preserve the author's voice. Do not add new ideas — only clarify existing ones.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'authority_voice_editor',
    name: 'Authority Voice Editor',
    description: 'Elevates writing to sound like a recognized domain expert — confident, specific, and free of hedging language.',
    category: 'editing',
    tags: ['editing', 'authority', 'voice', 'expertise'],
    systemPrompt: `You are a ghostwriter for C-suite executives and domain experts. You know that authority in writing comes from specificity, confidence, and the absence of hedging. You rewrite content to sound like it was written by someone who has spent 20 years in the field: they don't say "might" or "could potentially" when they mean "will" or "does". They use specific examples instead of vague gestures. They make declarative statements. They reference the texture of real experience. You elevate the writing without inventing claims or changing facts.`,
    userPrompt: `Rewrite the following content to sound like it was written by a recognized domain expert.\n\nOriginal content:\n{agents.body_writer.output}\n\nTopic domain: {topic}\n\nTransformations to make:\n1. Replace hedging language (might, could, perhaps, seems to, appears to) with confident assertions where the content supports it\n2. Add one specific, concrete example per major point (invent a plausible scenario if none is present — label invented examples as [EXAMPLE])\n3. Rewrite any vague claims as precise ones\n4. Ensure the opening sentence of each section makes a bold, clear claim\n\nDo not change facts. Preserve structure. Elevate confidence and specificity.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
  {
    uid: 'transition_writer',
    name: 'Transition Writer',
    description: 'Writes smooth connecting sentences and paragraphs between article sections so the piece reads as one coherent argument rather than separate parts.',
    category: 'editing',
    tags: ['editing', 'flow', 'transitions', 'coherence'],
    systemPrompt: `You are an editor specializing in narrative flow and article coherence. You understand that the space between sections is where readers decide to stop reading. A great transition: (1) references something concrete from the section that just ended, (2) signals why the next section is the logical next step, (3) does this in 1–3 sentences without being formulaic ("Now that we've covered X, let's look at Y..."). You also identify where transitions are missing entirely and where paragraph-level bridges are needed within sections.`,
    userPrompt: `Add or improve transitions in the following article content.\n\nContent:\n{agents.body_writer.output}\n\nFor each major section boundary:\n1. Write a 1–3 sentence transition that bridges the end of one section to the beginning of the next\n2. Mark where you've added or changed a transition with [TRANSITION ADDED] or [TRANSITION IMPROVED]\n\nAlso identify 2–3 places within sections where a single bridging sentence would improve flow and add it there.\n\nDo not rewrite the sections themselves — only the connective tissue between and within them.`,
    outputTarget: 'body',
    outputFormat: 'text',
  },
]

async function main() {
  // Create owner user
  const hash = await bcrypt.hash('password123', 12)
  const owner = await db.user.upsert({
    where: { email: 'admin@agentpress.local' },
    update: {},
    create: { email: 'admin@agentpress.local', passwordHash: hash, role: 'OWNER' },
  })

  const community = await db.workspace.upsert({
    where: { slug: 'community' },
    update: { name: 'Community', type: 'COMMUNITY' },
    create: { name: 'Community', slug: 'community', type: 'COMMUNITY' },
  })
  const personal = await db.workspace.upsert({
    where: { slug: `personal-${owner.id}` },
    update: { type: 'PERSONAL' },
    create: { name: 'Personal', slug: `personal-${owner.id}`, type: 'PERSONAL' },
  })
  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: personal.id, userId: owner.id } },
    update: { role: 'OWNER' },
    create: { workspaceId: personal.id, userId: owner.id, role: 'OWNER' },
  })

  // ── SEO Blog Post pipeline ─────────────────────────────────────────────
  const pipeline = await db.pipeline.upsert({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'seo-blog-post' } },
    update: { workspaceId: community.id, visibility: 'PUBLIC', destinationId: null, category: 'content' },
    create: {
      name: 'SEO Blog Post',
      slug: 'seo-blog-post',
      description: 'Generate a full SEO-optimized blog post from a topic and keyword.',
      category: 'content',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
      workspaceId: community.id,
      visibility: 'PUBLIC',
    },
  })

  await db.pipelineVariable.deleteMany({ where: { pipelineId: pipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: pipeline.id, key: 'topic', label: 'Topic', type: 'text', required: true, exampleValue: 'The benefits of content marketing for B2B companies', sortOrder: 0 },
      { pipelineId: pipeline.id, key: 'target_keyword', label: 'Target keyword', type: 'text', required: false, exampleValue: 'content marketing strategy', sortOrder: 1 },
      { pipelineId: pipeline.id, key: 'audience', label: 'Target audience', type: 'text', required: false, defaultValue: 'marketing professionals', exampleValue: 'B2B marketing managers and content leads', sortOrder: 2 },
      { pipelineId: pipeline.id, key: 'tone', label: 'Tone', type: 'text', required: false, defaultValue: 'professional', exampleValue: 'professional', sortOrder: 3 },
      { pipelineId: pipeline.id, key: 'word_count', label: 'Word count', type: 'number', required: false, defaultValue: '1500', exampleValue: '1500', sortOrder: 4 },
    ],
  })

  await db.pipelineAgent.deleteMany({ where: { pipelineId: pipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: pipeline.id,
        uid: 'researcher',
        name: 'Researcher',
        systemPrompt: `You are a senior content strategist with expertise in long-form SEO content. You research topics thoroughly and produce structured outlines that give writers everything they need to produce authoritative, comprehensive articles. Your outlines use H2 sections and H3 subpoints, each with a brief summary of what to cover.`,
        userPrompt: `Research and outline an article on the following.\n\nTopic: {topic}\nTarget keyword: {target_keyword}\nTarget audience: {audience}\nTone: {tone}\n\nProvide:\n1. A one-sentence thesis — the specific argument or insight the article will make\n2. A structured outline with 4–6 H2 sections, each with 2–3 H3 subpoints and a one-sentence summary of what to cover\n3. Three to five types of evidence, data, or examples that would strengthen the article\n4. A suggested hook approach for the opening paragraph`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: pipeline.id,
        uid: 'title_writer',
        name: 'Title Writer',
        systemPrompt: `You are an SEO copywriter who writes titles that rank and get clicked. A great title places the target keyword near the front, stays under 65 characters, and gives the reader a specific reason to care. You output one final title — clean, no quotes, no explanation.`,
        userPrompt: `Write an SEO-optimized title for this article.\n\nTopic: {topic}\nTarget keyword: {target_keyword}\nOutline and thesis: {agents.researcher.output}\n\nRequirements:\n- Place the target keyword in the first half of the title\n- Under 65 characters\n- Specific and benefit-forward — the reader should know exactly what they will learn\n\nOutput only the final title. No quotes, no options, no explanation.`,
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: pipeline.id,
        uid: 'body_writer',
        name: 'Body Writer',
        systemPrompt: `You are a professional long-form blog writer. You write comprehensive, well-structured articles that inform and engage readers from the first paragraph to the last. You use clear H2 headings, concrete examples, and a consistent voice throughout. You never pad word count with filler — every paragraph earns its place.`,
        userPrompt: `Write a full blog post of approximately {word_count} words.\n\nTitle: {agents.title_writer.output}\nOutline and research: {agents.researcher.output}\nTone: {tone}\nAudience: {audience}\n\nRequirements:\n- Use markdown with ## H2 headings for each section from the outline\n- Open with a compelling paragraph that earns the reader's attention\n- Each section should include a concrete example or specific detail\n- Use **bold** to highlight key terms on first use\n- End with a conclusion that gives the reader one clear takeaway or next step\n- Do not include a table of contents`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: pipeline.id,
        uid: 'excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: `You write meta descriptions and post excerpts for SEO and social sharing. A great excerpt includes the target keyword naturally, promises a specific benefit, and stays under 160 characters. You output only the excerpt — no explanation, no options.`,
        userPrompt: `Write a 1–2 sentence excerpt for this blog post.\n\nTitle: {agents.title_writer.output}\nTarget keyword: {target_keyword}\nOpening section: {agents.body_writer.output}\n\nRequirements:\n- Include the target keyword naturally in the first sentence\n- Under 160 characters total\n- Promise a specific benefit — what will the reader learn or gain?\n\nOutput only the excerpt.`,
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 3,
      },
      {
        pipelineId: pipeline.id,
        uid: 'seo_thumbnail',
        name: 'Thumbnail',
        systemPrompt: ``,
        userPrompt: `Generate a clean, professional blog post thumbnail image.\n\nPost title: {agents.title_writer.output}\nTopic: {topic}\n\nStyle: modern editorial. Bold typography-inspired composition with a relevant visual metaphor for the topic. Clean background, professional color palette. No text in the image.`,
        outputTarget: 'thumbnail',
        outputFormat: 'image',
        imageMode: 'generate',
        enabled: true,
        sortOrder: 4,
      },
    ],
  })

  // ── Political Commentary pipeline ──────────────────────────────────────
  const politicalPipeline = await db.pipeline.upsert({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'political-commentary' } },
    update: { workspaceId: community.id, visibility: 'PUBLIC', destinationId: null, category: 'politics' },
    create: {
      name: 'Political Commentary',
      slug: 'political-commentary',
      description: 'Turn a political video transcript into a structured commentary post — argument mapped, intro written, body drafted, and thumbnail generated. Loop it against Vaush or any political source.',
      category: 'politics',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
      workspaceId: community.id,
      visibility: 'PUBLIC',
    },
  })

  await db.pipelineVariable.deleteMany({ where: { pipelineId: politicalPipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: politicalPipeline.id, key: 'audience', label: 'Target audience', type: 'text', required: false, defaultValue: 'politically engaged progressives', exampleValue: 'politically engaged progressives', sortOrder: 0 },
      { pipelineId: politicalPipeline.id, key: 'tone', label: 'Tone', type: 'text', required: false, defaultValue: 'analytical', exampleValue: 'analytical', sortOrder: 1 },
    ],
  })

  await db.pipelineAgent.deleteMany({ where: { pipelineId: politicalPipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: politicalPipeline.id,
        uid: 'argument_mapper',
        name: 'Argument Mapper',
        systemPrompt: `You are a political analyst and debate coach. You read political commentary and break it into its argumentative skeleton: the central claim, the evidence marshaled, the strongest counterarguments, and what is at stake. You do not editorialize — you map what is there. You work only from the material provided. Your output becomes the raw material for a writer, so it must be specific, structured, and faithful to the source.`,
        userPrompt: `Read the following content and map out its argumentative structure.\n\nContent (uploaded {vaush.date}):\n{vaush.summary}\n\nProvide:\n\n**Central Claim** — one precise sentence: the exact position being argued.\n\n**Key Arguments** (3–5) — for each: a title and 2 sentences stating the argument and its supporting evidence from the content.\n\n**What's Contested** — the 2 most credible objections a reasonable opponent would raise. State them fairly.\n\n**Stakes** — why does this argument matter right now? One sentence on the real-world consequence of winning or losing this debate.\n\nBe specific. Name the policies, people, events, and data points mentioned in the content.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: politicalPipeline.id,
        uid: 'intro_writer',
        name: 'Intro Writer',
        systemPrompt: `You write opening sections for political commentary posts. A great political intro does three things: (1) drops the reader into a specific moment or claim from the source material, (2) establishes what is actually at stake, and (3) signals the analytical angle the post will take. It never starts with "In this post" or "Today we'll explore." It opens like an op-ed — with a concrete, specific scene or claim that earns the reader's attention. Target: 3–4 sentences, punchy and direct.`,
        userPrompt: `Write the opening section for this political commentary post.\n\nContent:\n{vaush.summary}\n\nArgument map:\n{agents.argument_mapper.output}\n\nTone: {tone}\nAudience: {audience}\n\nWrite 3–4 sentences that: open with a specific moment or claim from the content, name what is actually at stake, and signal the analytical angle of this post. No filler, no scene-setting about the creator — open with the idea.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: politicalPipeline.id,
        uid: 'body_writer',
        name: 'Body Writer',
        systemPrompt: `You are a political journalist who writes structured commentary for a smart, skeptical audience. You write in clear markdown with H2 headings. You represent arguments fairly before evaluating them. You do not manufacture quotes — you paraphrase accurately from the material provided. You write concisely: every paragraph earns its place. You balance explaining the position with genuine critical engagement. Total target: 600–900 words.`,
        userPrompt: `Write the body of this political commentary post.\n\nContent (uploaded {vaush.date}):\n{vaush.summary}\n\nArgument map:\n{agents.argument_mapper.output}\n\nTone: {tone}\nAudience: {audience}\n\nStructure the body with these H2 sections:\n## The Core Argument\nSummarize the central claim in 2–3 sentences with precision. Name the specific policies, people, or events involved.\n\n## Key Points Made\n3–5 of the strongest arguments — each as a subheading + 2–3 sentences explaining and evaluating it.\n\n## Where This Gets Contested\n2 credible counterarguments, stated fairly. Explain why someone who disagrees isn't simply wrong.\n\n## Why It Matters\nThe real-world stakes. Connect to current events, upcoming votes, or ongoing policy debates.\n\n## Bottom Line\nOne clear takeaway for the reader. What should they think, question, or do differently?`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: politicalPipeline.id,
        uid: 'political_title_writer',
        name: 'Title Writer',
        systemPrompt: `You are a headline writer for a politically engaged digital publication. You write titles that are specific, compelling, and accurate — they reflect the actual argument of the piece, not manufactured outrage. Good political titles name the specific issue and signal the analytical angle. Under 70 characters. Output only the title — no quotes, no options.`,
        userPrompt: `Write a title for this political commentary post.\n\nIntro:\n{agents.intro_writer.output}\n\nBody:\n{agents.body_writer.output}\n\nRequirements:\n- Name the specific issue or claim being analyzed\n- Under 70 characters\n- Signal the analytical angle — not clickbait, not vague\n\nOutput only the final title.`,
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 3,
      },
      {
        pipelineId: politicalPipeline.id,
        uid: 'political_excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: `You write excerpts for political commentary posts. A great excerpt names the specific issue, signals the angle, and makes a reader want to read more — in under 200 characters. No "In this article" or "We explore." Read like the first sentence of an op-ed: confident and specific.`,
        userPrompt: `Write a 1–2 sentence excerpt for this political commentary post.\n\nTitle: {agents.political_title_writer.output}\nIntro: {agents.intro_writer.output}\n\nRequirements:\n- 1–2 sentences, under 200 characters\n- Name the specific issue\n- Confident and direct — reads like an op-ed opener\n\nOutput only the excerpt.`,
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 4,
      },
      {
        pipelineId: politicalPipeline.id,
        uid: 'political_thumbnail',
        name: 'Thumbnail',
        systemPrompt: ``,
        userPrompt: `Generate a bold editorial thumbnail image for a political commentary blog post.\n\nPost title: {agents.political_title_writer.output}\n\nStyle: editorial photography aesthetic, high contrast, serious tone. Abstract representation of political debate or decision-making — think podiums, crowds, flags, scales of justice, or bold graphic shapes. No text in the image. Professional and striking.`,
        outputTarget: 'thumbnail',
        outputFormat: 'image',
        imageMode: 'generate',
        enabled: true,
        sortOrder: 5,
      },
    ],
  })

  // ── Daily Market Brief pipeline ───────────────────────────────────────
  const marketBriefPipeline = await db.pipeline.upsert({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'daily-market-brief' } },
    update: { workspaceId: community.id, visibility: 'PUBLIC', category: 'financial' },
    create: {
      name: 'Daily Market Brief',
      slug: 'daily-market-brief',
      description: 'Aggregate summaries from all financial sources into a concise daily market brief — top tickers across the web, consensus sentiment, key risk, and a clear bottom line.',
      category: 'financial',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
      workspaceId: community.id,
      visibility: 'PUBLIC',
    },
  })

  await db.pipelineVariable.deleteMany({ where: { pipelineId: marketBriefPipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: marketBriefPipeline.id, key: 'date_label', label: 'Date label', type: 'text', required: false, defaultValue: '', exampleValue: 'Monday June 23', sortOrder: 0 },
    ],
  })

  await db.pipelineAgent.deleteMany({ where: { pipelineId: marketBriefPipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'ticker_extractor',
        name: 'Ticker Extractor',
        systemPrompt: `You are a financial analyst who extracts and evaluates every stock and ETF mention from financial media content. You work only from what is explicitly stated or strongly implied — you never invent reasoning. You produce clean, structured output a trading desk can act on.`,
        userPrompt: `Extract all stocks, ETFs, and sectors mentioned across today's financial sources. Skip any source block that shows no content.\n\n**YouTube — Financial:**\nZipTrader ({ziptrader.date}): {ziptrader.summary}\nSpencer Invests ({spencer-invests.date}): {spencer-invests.summary}\nStock Moe ({stock-moe.date}): {stock-moe.summary}\nTom Nash TV ({tom-nash-tv.date}): {tom-nash-tv.summary}\nMeet Kevin ({meet-kevin.date}): {meet-kevin.summary}\nHeresy Financial ({heresy-financial.date}): {heresy-financial.summary}\nWallStreetZen ({wallstreetzen.date}): {wallstreetzen.summary}\n\n**Reddit:**\nWallStreetBets ({wallstreetbets.date}): {wallstreetbets.summary}\nr/stocks ({r-stocks.date}): {r-stocks.summary}\n\n**Financial News:**\nYahoo Finance ({yahoo-finance.date}): {yahoo-finance.summary}\nMarketWatch ({marketwatch.date}): {marketwatch.summary}\n\nFor each mentioned ticker or sector:\n- Ticker symbol and company/ETF name\n- Consensus sentiment across sources: Bullish / Bearish / Neutral / Mixed\n- Key reason cited (one sentence)\n- Which source(s) mentioned it\n\nFormat as a markdown table: | Ticker | Sentiment | Key Reason | Sources |\n\nList tickers mentioned by multiple sources first. Mark Mixed sentiment if sources disagree. If no specific tickers appear, say so.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'market_read',
        name: 'Market Read',
        systemPrompt: `You are a market strategist who synthesizes financial commentary into a clear, evidence-based market read. You distinguish short-term signals from longer-term thesis. You are specific — you cite what was actually said rather than making vague generalizations. You do not editorialize beyond what the source supports.`,
        userPrompt: `Assess the overall market mood across today's financial sources. Skip any source block that shows no content.\n\n**YouTube — Financial:**\nZipTrader ({ziptrader.date}): {ziptrader.summary}\nSpencer Invests ({spencer-invests.date}): {spencer-invests.summary}\nStock Moe ({stock-moe.date}): {stock-moe.summary}\nTom Nash TV ({tom-nash-tv.date}): {tom-nash-tv.summary}\nMeet Kevin ({meet-kevin.date}): {meet-kevin.summary}\nHeresy Financial ({heresy-financial.date}): {heresy-financial.summary}\nWallStreetZen ({wallstreetzen.date}): {wallstreetzen.summary}\n\n**Reddit:**\nWallStreetBets ({wallstreetbets.date}): {wallstreetbets.summary}\nr/stocks ({r-stocks.date}): {r-stocks.summary}\n\n**Financial News:**\nYahoo Finance ({yahoo-finance.date}): {yahoo-finance.summary}\nMarketWatch ({marketwatch.date}): {marketwatch.summary}\n\nProvide:\n1. **Overall sentiment**: Bullish / Bearish / Neutral / Mixed with a 1–10 conviction score\n2. **Primary driver**: The single most important factor shaping today's market mood\n3. **Consensus themes**: 2–3 ideas multiple sources are agreeing on\n4. **Divergence**: Where are sources disagreeing?\n5. **Key risks flagged**: Warnings, concerns, or wildcards mentioned\n6. **Time horizon implied**: Are sources mostly discussing intraday, swing, or longer positions?\n\nBe specific. Quote or closely paraphrase the source material.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'brief_writer',
        name: 'Brief Writer',
        systemPrompt: `You write concise daily market brief posts for retail investors who want clear signals without the noise. Your briefs are 250–400 words. They open with one punchy market read sentence, cover the most actionable tickers, note the key risk, and close with a single bottom-line takeaway. You write in direct, jargon-free prose — no hype, no filler, no boilerplate.`,
        userPrompt: `Write a daily market brief post from the following analysis.\n\n{date_label}\n\nTicker data:\n{agents.ticker_extractor.output}\n\nMarket read:\n{agents.market_read.output}\n\nStructure the post as:\n1. **Market read** — 1–2 sentences on the overall mood across today's sources\n2. **Key tickers** — 5–8 bullet points: ticker, direction, one-line reason, source(s) citing it\n3. **Consensus** — what are most sources agreeing on today?\n4. **Risk watch** — 1–2 sentences on the most important risk or wildcard flagged\n5. **Bottom line** — 1 sentence, the single most actionable takeaway\n\nTarget length: 300–450 words. Tone: clear, direct, no hype.`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'brief_title_writer',
        name: 'Title Writer',
        systemPrompt: `You write titles for daily market brief posts. A good title states the overall market mood and names the most notable specific callout — a ticker, a sector, or a catalyst. Under 70 characters. Output only the title, no quotes or explanation.`,
        userPrompt: `Write a title for this market brief.\n\nBrief:\n{agents.brief_writer.output}\n\nTickers covered:\n{agents.ticker_extractor.output}\n\nOutput only the title. Under 70 characters. Name the market mood and one specific callout.`,
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 3,
      },
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'brief_excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: `You write single-sentence excerpts for market brief posts. Name the overall market mood and one specific ticker or catalyst. Under 160 characters. Output only the excerpt.`,
        userPrompt: `Write a 1-sentence excerpt for this market brief. Name the mood and one specific callout.\n\n{agents.brief_writer.output}\n\nOutput only the excerpt. Under 160 characters.`,
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 4,
      },
      {
        pipelineId: marketBriefPipeline.id,
        uid: 'market_thumbnail',
        name: 'Thumbnail',
        systemPrompt: ``,
        userPrompt: `Generate a bold financial market thumbnail image.\n\nPost title: {agents.brief_title_writer.output}\n\nStyle: modern financial aesthetic — stock charts, upward/downward arrows, bull/bear imagery, or abstract market data visualization. High contrast. Professional. No text in the image.`,
        outputTarget: 'thumbnail',
        outputFormat: 'image',
        imageMode: 'generate',
        enabled: true,
        sortOrder: 5,
      },
    ],
  })

  // ── This Week in AI pipeline ───────────────────────────────────────────
  const aiWeeklyPipeline = await db.pipeline.upsert({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'this-week-in-ai' } },
    update: { workspaceId: community.id, visibility: 'PUBLIC', category: 'ai' },
    create: {
      name: 'This Week in AI',
      slug: 'this-week-in-ai',
      description: 'Paste summaries from multiple AI/tech sources and get a structured weekly roundup post — themes identified, stories written, and a "what to watch" closer.',
      category: 'ai',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
      workspaceId: community.id,
      visibility: 'PUBLIC',
    },
  })

  await db.pipelineVariable.deleteMany({ where: { pipelineId: aiWeeklyPipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: aiWeeklyPipeline.id, key: 'week_of', label: 'Week of', type: 'text', required: false, exampleValue: 'June 16, 2025', sortOrder: 0 },
      { pipelineId: aiWeeklyPipeline.id, key: 'audience', label: 'Target audience', type: 'text', required: false, defaultValue: 'technically literate AI/tech followers', exampleValue: 'developers and founders following AI', sortOrder: 1 },
    ],
  })

  await db.pipelineAgent.deleteMany({ where: { pipelineId: aiWeeklyPipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'theme_extractor',
        name: 'Theme Extractor',
        systemPrompt: `You are a senior AI industry analyst who reads summaries from 20+ sources each week and identifies the most significant recurring themes. You cluster related developments into 3–5 concrete themes. You are specific — you name the exact tools, models, companies, benchmarks, and capabilities involved. You skip vague generalities like "AI is advancing." You rank by actual significance to practitioners, not buzz.`,
        userPrompt: `Identify the 3–5 most significant AI/tech developments this week from across all sources below. Skip any source with no content.\n\n**AI / ML Creators:**\nAIAgentsStudio ({aiagentsstudio.date}): {aiagentsstudio.summary}\nNate Herk ({nateherk.date}): {nateherk.summary}\nIntheworldofai ({intheworldofai.date}): {intheworldofai.summary}\nAIBrainbox ({aibrainbox.date}): {aibrainbox.summary}\nNetworkChuck ({networkchuck.date}): {networkchuck.summary}\nWes Roth ({wesroth.date}): {wesroth.summary}\nManuAGI ({manuagi.date}): {manuagi.summary}\nRealrobtheaiguy ({realrobtheaiguy.date}): {realrobtheaiguy.summary}\nMr. E Flow ({mr-e-flow.date}): {mr-e-flow.summary}\nGitHub Awesome ({github-awesome.date}): {github-awesome.summary}\nThe AI Search ({the-ai-search.date}): {the-ai-search.summary}\nAI Labs ({ai-labs.date}): {ai-labs.summary}\nAI Code King ({ai-code-king.date}): {ai-code-king.summary}\nPrompt Engineer ({prompt-engineer.date}): {prompt-engineer.summary}\nI Am AI Master ({i-am-ai-master.date}): {i-am-ai-master.summary}\nKittl Design ({kittl-design.date}): {kittl-design.summary}\n\n**Tech / Dev:**\nFireship ({fireship.date}): {fireship.summary}\nTheo ({theo.date}): {theo.summary}\nThePrimeagen ({theprimeagen.date}): {theprimeagen.summary}\n\n**Tech News:**\nHacker News ({hacker-news.date}): {hacker-news.summary}\nTechCrunch ({techcrunch.date}): {techcrunch.summary}\n\nFor each theme:\n- **Theme headline** (under 8 words — name the specific tool, model, or company)\n- One sentence: what happened and why it matters to AI practitioners\n- Which sources covered it\n\nRank by significance. Name exact tools, models, benchmark numbers, and companies. Only report what sources actually state.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'story_writer',
        name: 'Story Writer',
        systemPrompt: `You write the body sections of a weekly AI/tech roundup for a technically literate audience. For each theme, you write a tight 150–200 word story that explains what happened, why it matters, and what it signals for the field. You are specific: names, numbers, companies, and tools — no vague generalities. You do not editorialize or hype.`,
        userPrompt: `Write a story section for each theme in this week's AI/tech roundup.\n\nAudience: {audience}\n\nThemes:\n{agents.theme_extractor.output}\n\nSource material:\nAIAgentsStudio ({aiagentsstudio.date}): {aiagentsstudio.summary}\nNate Herk ({nateherk.date}): {nateherk.summary}\nIntheworldofai ({intheworldofai.date}): {intheworldofai.summary}\nAIBrainbox ({aibrainbox.date}): {aibrainbox.summary}\nNetworkChuck ({networkchuck.date}): {networkchuck.summary}\nWes Roth ({wesroth.date}): {wesroth.summary}\nManuAGI ({manuagi.date}): {manuagi.summary}\nRealrobtheaiguy ({realrobtheaiguy.date}): {realrobtheaiguy.summary}\nMr. E Flow ({mr-e-flow.date}): {mr-e-flow.summary}\nGitHub Awesome ({github-awesome.date}): {github-awesome.summary}\nThe AI Search ({the-ai-search.date}): {the-ai-search.summary}\nAI Labs ({ai-labs.date}): {ai-labs.summary}\nAI Code King ({ai-code-king.date}): {ai-code-king.summary}\nPrompt Engineer ({prompt-engineer.date}): {prompt-engineer.summary}\nI Am AI Master ({i-am-ai-master.date}): {i-am-ai-master.summary}\nKittl Design ({kittl-design.date}): {kittl-design.summary}\nFireship ({fireship.date}): {fireship.summary}\nTheo ({theo.date}): {theo.summary}\nThePrimeagen ({theprimeagen.date}): {theprimeagen.summary}\nHacker News ({hacker-news.date}): {hacker-news.summary}\nTechCrunch ({techcrunch.date}): {techcrunch.summary}\n\nFor each theme write:\n## [Theme Headline]\n2–3 focused paragraphs: what happened, why it matters, what it signals for the field. Name the specific tools, models, companies, and capabilities — no vague generalities. 150–200 words per theme.`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'roundup_title_writer',
        name: 'Title Writer',
        systemPrompt: `You write titles for weekly AI/tech roundup newsletters. A good title names the biggest specific story of the week — not just "AI news" or "weekly roundup." Under 70 characters. Output only the title.`,
        userPrompt: `Write a title for this week's AI/tech roundup.\n\nBiggest themes:\n{agents.theme_extractor.output}\n\nOutput only the title. Name the single biggest story specifically. Under 70 characters.`,
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'roundup_composer',
        name: 'Roundup Composer',
        systemPrompt: `You assemble weekly AI/tech roundup posts into a single cohesive article. You write a punchy 3–4 sentence intro that frames the defining narrative of the week, then weave the theme stories into a flowing article, then close with a "What to Watch Next Week" section. You do not summarize the theme stories — you frame them with transitions and context so the whole piece reads as one coherent analysis rather than a list. Total target: 800–1100 words.`,
        userPrompt: `Assemble this week's AI/tech roundup post into a complete article.\n\nTitle: {agents.roundup_title_writer.output}\nWeek of: {week_of}\nAudience: {audience}\n\nThemes identified:\n{agents.theme_extractor.output}\n\nStory sections written:\n{agents.story_writer.output}\n\nWrite the full article as:\n\n## [Title from above]\n\n**Opening (3–4 sentences):** What was the defining shift or story of this week? Why does this week matter for the field? Frame the narrative arc.\n\n[Reproduce each theme story section from the story_writer, adding a 1-sentence transition before each that connects it to the broader week's narrative]\n\n## What to Watch Next Week\n3 specific bullet points — name the companies, model releases, regulatory decisions, or events to follow. Ground each in what happened this week.`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 3,
      },
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'roundup_excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: `You write excerpts for weekly AI/tech roundup posts. 1–2 sentences naming the 2 biggest specific stories of the week. Under 200 characters. Output only the excerpt.`,
        userPrompt: `Write a 1–2 sentence excerpt for this week's AI roundup.\n\nTitle: {agents.roundup_title_writer.output}\nThemes: {agents.theme_extractor.output}\n\nName the 2 biggest stories specifically. Under 200 characters. Output only the excerpt.`,
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 4,
      },
      {
        pipelineId: aiWeeklyPipeline.id,
        uid: 'ai_thumbnail',
        name: 'Thumbnail',
        systemPrompt: ``,
        userPrompt: `Generate a bold tech/AI weekly roundup thumbnail image.\n\nPost title: {agents.roundup_title_writer.output}\n\nStyle: futuristic, digital, high-tech aesthetic — neural networks, glowing circuits, data streams, or abstract AI imagery. Bold and eye-catching. Dark background with bright accent colors (electric blue, purple, or green). No text in the image.`,
        outputTarget: 'thumbnail',
        outputFormat: 'image',
        imageMode: 'generate',
        enabled: true,
        sortOrder: 5,
      },
    ],
  })

  // ── Investment Thesis Builder pipeline (loop-ready) ────────────────────
  const thesisPipeline = await db.pipeline.upsert({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'investment-thesis-builder' } },
    update: { workspaceId: community.id, visibility: 'PUBLIC', category: 'financial' },
    create: {
      name: 'Investment Thesis Builder',
      slug: 'investment-thesis-builder',
      description: 'Build a full bull/bear investment thesis from a financial video or transcript. Loop it against ZipTrader or SpencerInvests to auto-generate one thesis per video.',
      category: 'financial',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
      workspaceId: community.id,
      visibility: 'PUBLIC',
    },
  })

  await db.pipelineVariable.deleteMany({ where: { pipelineId: thesisPipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: thesisPipeline.id, key: 'context', label: 'Transcript or summary', type: 'text', required: true, exampleValue: 'Paste the video transcript or summary here — or connect a research source loop to fill this automatically.', sortOrder: 0 },
      { pipelineId: thesisPipeline.id, key: 'time_horizon', label: 'Time horizon', type: 'text', required: false, defaultValue: 'medium-term (3–6 months)', exampleValue: 'short-term swing trade', sortOrder: 1 },
      { pipelineId: thesisPipeline.id, key: 'risk_appetite', label: 'Risk appetite', type: 'text', required: false, defaultValue: 'moderate', exampleValue: 'aggressive', sortOrder: 2 },
    ],
  })

  await db.pipelineAgent.deleteMany({ where: { pipelineId: thesisPipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: thesisPipeline.id,
        uid: 'ticker_identifier',
        name: 'Ticker Identifier',
        systemPrompt: `You are a financial analyst. Read the provided content and identify the single primary stock or ETF being analyzed. Output exactly one line in this format: TICKER — Company Name (e.g. AAPL — Apple Inc.). If multiple stocks are discussed, pick the one most deeply analyzed. Output only that one line — no explanation, no extras.`,
        userPrompt: `Identify the primary stock being discussed in this content.\n\nContent:\n{context}\n\nOutput exactly one line: TICKER — Company Name`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'bull_case',
        name: 'Bull Case',
        systemPrompt: `You are a buy-side equity analyst constructing the bull case for a stock. You present exactly 3 specific, evidence-based reasons to be bullish. Each reason references something concrete from the content provided: a financial metric, competitive moat, catalyst, or trend. You do not invent data — if a figure is mentioned you use it, if not you describe the type of evidence the argument rests on. You are persuasive but honest.`,
        userPrompt: `Make the bull case for this stock.\n\nStock: {agents.ticker_identifier.output}\nTime horizon: {time_horizon}\n\nContent to analyze:\n{context}\n\nPresent exactly 3 bullish arguments:\n**1. [Argument title]** — 2–3 sentences with specific evidence from the content\n**2. [Argument title]** — 2–3 sentences with specific evidence\n**3. [Argument title]** — 2–3 sentences with specific evidence\n\nBe specific. Cite what was actually said or demonstrated in the content.`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'bear_case',
        name: 'Bear Case',
        systemPrompt: `You are a short-seller and risk analyst presenting the strongest case AGAINST a stock. You steel-man the bear case — no strawmen. You draw from the content provided and your knowledge of common risks in this sector. You rate key risk categories honestly. A smart bull should read this and feel genuinely challenged.`,
        userPrompt: `Present the bear case and risk matrix for this stock.\n\nStock: {agents.ticker_identifier.output}\nTime horizon: {time_horizon}\nRisk appetite: {risk_appetite}\n\nContent analyzed:\n{context}\n\nProvide:\n**3 Bear Arguments** — each with a title and 2–3 specific sentences making the strongest case\n\n**Risk Matrix** — rate each category Low / Medium / High with one sentence of reasoning:\n- Macro risk\n- Sector/competitive risk\n- Company-specific risk\n- Valuation risk\n- Liquidity/timing risk`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'verdict_writer',
        name: 'Verdict',
        systemPrompt: `You are a portfolio manager who synthesizes bull and bear arguments into a decisive investment verdict. You are clear — Buy / Hold / Avoid — with a specific rationale that explains which side of the argument wins and why. You note conviction level and what specific catalysts or data points would change your view. You do not hedge everything into meaninglessness.`,
        userPrompt: `Synthesize this analysis into a clear investment verdict.\n\nStock: {agents.ticker_identifier.output}\nTime horizon: {time_horizon}\nRisk appetite: {risk_appetite}\n\nBull case:\n{agents.bull_case.output}\n\nBear case and risks:\n{agents.bear_case.output}\n\nProvide:\n**Verdict**: Buy / Hold / Avoid\n**Rationale**: 2–3 sentences — which argument wins and why\n**Conviction**: Low / Medium / High\n**What would change this view**: 2 specific catalysts or data points that would flip the thesis`,
        outputTarget: 'body',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 3,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'thesis_title_writer',
        name: 'Title Writer',
        systemPrompt: `You write titles for investment thesis posts. A good title names the ticker, signals the verdict direction (bull or bear), and gives one specific compelling reason. Under 70 characters. Output only the title — no quotes, no explanation.`,
        userPrompt: `Write a title for this investment thesis.\n\nStock: {agents.ticker_identifier.output}\nVerdict: {agents.verdict_writer.output}\n\nOutput only the title. Name the ticker and signal the direction with a specific hook. Under 70 characters.`,
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 4,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'thesis_writer',
        name: 'Thesis Writer',
        systemPrompt: `You write investment thesis articles for retail investors who want rigorous analysis without finance jargon. A great thesis post has a clear structure: one-line take, bull case, bear case, key risks, verdict, and what to watch. You write in confident, direct prose using markdown headers. You do not repeat the same point across sections. Total length: 600–900 words.`,
        userPrompt: `Write a complete investment thesis article.\n\nStock: {agents.ticker_identifier.output}\n\nBull case:\n{agents.bull_case.output}\n\nBear case and risks:\n{agents.bear_case.output}\n\nVerdict:\n{agents.verdict_writer.output}\n\nWrite a 600–900 word article with these sections:\n## The One-Line Take\n## The Bull Case\n## The Bear Case\n## Key Risks\n## The Verdict\n## What to Watch\n\nTone: confident, analytical, no hype. Write for a smart retail investor who can handle nuance.`,
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 5,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'thesis_excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: `You write excerpts for investment thesis posts. 1–2 sentences: name the ticker, the verdict, and the single most compelling reason. Under 200 characters. Output only the excerpt.`,
        userPrompt: `Write a 1–2 sentence excerpt for this investment thesis.\n\nTitle: {agents.thesis_title_writer.output}\nVerdict: {agents.verdict_writer.output}\n\nName the ticker, the verdict, and the key reason. Under 200 characters. Output only the excerpt.`,
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 6,
      },
      {
        pipelineId: thesisPipeline.id,
        uid: 'thesis_thumbnail',
        name: 'Thumbnail',
        systemPrompt: ``,
        userPrompt: `Generate a bold investment thesis thumbnail image.\n\nPost title: {agents.thesis_title_writer.output}\nVerdict: {agents.verdict_writer.output}\n\nStyle: financial editorial — stock ticker boards, bull/bear imagery, upward/downward trend lines, or abstract market data. High contrast. Professional and decisive. The visual should reinforce whether the verdict is bullish or bearish. No text in the image.`,
        outputTarget: 'thumbnail',
        outputFormat: 'image',
        imageMode: 'generate',
        enabled: true,
        sortOrder: 7,
      },
    ],
  })

  // ── Summary prompts ────────────────────────────────────────────────────
  const SUMMARY_PROMPTS = [
    {
      name: 'News Brief',
      description: 'Who/what/when/why in under 150 words — journalist style.',
      isDefault: true,
      sortOrder: 0,
      systemPrompt: 'You are a wire-service journalist. Write tight, factual news briefs. Lead with the most important information. Use short sentences. No opinion. No filler.',
      userPrompt: 'Write a 100–150 word news brief summarizing the key facts from this transcript. Structure: one punchy lead sentence that captures the main story, then 2–3 sentences of supporting detail. End with one sentence of context or implication.\n\n{transcript}',
    },
    {
      name: 'Deep Analysis',
      description: 'Structured breakdown — argument, evidence, implications, counterpoints.',
      isDefault: false,
      sortOrder: 1,
      systemPrompt: 'You are a political and media analyst. You produce structured, rigorous analysis that identifies the core argument, evaluates the evidence, notes what is strong, and flags what is missing or contestable. You write in clear prose, not bullet lists.',
      userPrompt: 'Analyze this transcript in 3–4 paragraphs:\n1. Core argument or position being advanced\n2. Key evidence or examples used to support it\n3. What is compelling — and what is weak, missing, or contestable\n4. Broader significance or implication\n\n{transcript}',
    },
    {
      name: 'Key Takeaways',
      description: '5–7 punchy, standalone insights a reader can act on.',
      isDefault: false,
      sortOrder: 2,
      systemPrompt: 'You extract key takeaways from transcripts. Each takeaway is a single, specific, standalone sentence — not a vague summary. A reader who only reads the takeaways should understand the most important points. No intros, no padding.',
      userPrompt: 'Extract 5–7 key takeaways from this transcript. Each takeaway must be:\n- One sentence\n- Specific and concrete (not "AI is important" but "Companies using AI reduce costs by X")\n- Usable without reading the full transcript\n\nFormat as a numbered list.\n\n{transcript}',
    },
    {
      name: 'Content Angles',
      description: 'Extract 3–5 distinct blog/article angles from the material.',
      isDefault: false,
      sortOrder: 3,
      systemPrompt: 'You are a content strategist who finds blog post angles in raw source material. You identify what specific arguments, claims, or moments in a transcript could become standalone articles. Each angle you identify includes the hook and why it would resonate with an audience.',
      userPrompt: 'Identify 3–5 distinct blog post or article angles from this transcript. For each angle provide:\n- A working title (under 65 chars)\n- One sentence on what the piece would argue\n- One sentence on why this resonates with readers right now\n\n{transcript}',
    },
    {
      name: 'Social Hook',
      description: 'One punchy paragraph suitable for a social post or newsletter blurb.',
      isDefault: false,
      sortOrder: 4,
      systemPrompt: 'You write social media hooks and newsletter blurbs that make people stop scrolling. You are specific, direct, and slightly provocative. You do not start with "In this video" or "Check out". You write for an audience that is smart and skeptical.',
      userPrompt: 'Write one short social hook (2–4 sentences) based on the most interesting or surprising thing in this transcript. Make it specific enough to be intriguing without being clickbait. Write it as a standalone blurb.\n\n{transcript}',
    },
    // ── Financial-specific prompts ──────────────────────────────────────────
    {
      name: 'Ticker Extractor',
      description: 'Pull every stock ticker mentioned with its sentiment and the reason cited.',
      isDefault: false,
      sortOrder: 5,
      systemPrompt: 'You are a financial analyst assistant. Extract all stock ticker symbols and company names mentioned in the provided content. For each, determine the sentiment (bullish, bearish, neutral) and the specific reason given. Be concise and precise. Only report what is explicitly stated or strongly implied — do not invent reasoning.',
      userPrompt: 'Extract all stock tickers and companies mentioned in the following content. For each:\n- Ticker symbol (if mentioned) and company name\n- Sentiment: bullish / bearish / neutral\n- Reason: one sentence quoting or paraphrasing the specific argument made\n\nFormat as a table with columns: Ticker | Company | Sentiment | Reason\n\nIf no tickers are mentioned, say so.\n\n{transcript}',
    },
    {
      name: 'Market Sentiment',
      description: 'Overall market mood gauge — bull/bear/neutral with the key drivers cited.',
      isDefault: false,
      sortOrder: 6,
      systemPrompt: 'You are a market sentiment analyst. You read financial content and produce a clear, evidence-based assessment of the overall market mood expressed. You distinguish between short-term and long-term sentiment when both are present. You quote or closely paraphrase the specific statements driving your assessment.',
      userPrompt: 'Assess the overall market sentiment expressed in the following content.\n\nProvide:\n1. Overall sentiment: Bullish / Bearish / Neutral / Mixed (with a 1–10 conviction score, where 1 = weakly held, 10 = strongly convicted)\n2. Short-term outlook (days–weeks): summarize in one sentence\n3. Long-term outlook (months–years): summarize in one sentence\n4. Top 3 bullish signals mentioned (quote or paraphrase)\n5. Top 3 bearish signals mentioned (quote or paraphrase)\n6. Key catalysts or events being watched\n\n{transcript}',
    },
    {
      name: 'Risk Flags',
      description: 'Identify every risk, warning sign, or concern raised — prioritized by severity.',
      isDefault: false,
      sortOrder: 7,
      systemPrompt: 'You are a risk analyst. You read financial and market commentary and extract every risk factor, warning sign, or concern mentioned. You classify each by type (macro, sector, company-specific, technical, regulatory, liquidity) and by the severity implied by the source. You do not fabricate risks not mentioned in the content.',
      userPrompt: 'Identify all risks, warning signs, and concerns mentioned in the following content.\n\nFor each risk:\n- Risk description (one sentence)\n- Type: macro / sector / company-specific / technical / regulatory / liquidity / other\n- Severity implied: high / medium / low\n- Direct quote or close paraphrase from the content\n\nRank by severity (highest first). If no risks are explicitly mentioned, say so.\n\n{transcript}',
    },
    {
      name: 'Trade Ideas',
      description: 'Concrete trade setups, entries, targets, and stops mentioned in the content.',
      isDefault: false,
      sortOrder: 8,
      systemPrompt: 'You are a trading desk assistant. You extract specific, actionable trade ideas from financial commentary. You only report trades explicitly discussed — you do not invent setups. For each trade you identify the instrument, direction, rationale, and any price levels mentioned (entry, target, stop). You flag speculative or educational trades separately from high-conviction calls.',
      userPrompt: 'Extract all concrete trade ideas, setups, or recommendations mentioned in the following content.\n\nFor each trade idea:\n- Instrument (ticker, sector, asset class)\n- Direction: Long / Short / Neutral hedge\n- Time horizon: day trade / swing / position / long-term\n- Entry price or zone (if mentioned)\n- Price target (if mentioned)\n- Stop loss (if mentioned)\n- Rationale: one sentence summarizing why\n- Conviction level implied: speculative / moderate / high\n\nIf no specific trades are mentioned, say so clearly.\n\n{transcript}',
    },
    {
      name: 'AI Industry Brief',
      description: 'Ultra-tight AI/tech summary — specific tool or model, what was released or shown, why it matters. Under 60 words.',
      isDefault: false,
      sortOrder: 9,
      systemPrompt: 'You are an AI industry analyst summarizing technical content for practitioners. You are terse and precise. You name the exact tool, model, framework, or company involved. You never open with "In this video", "This week", "Today", or any scene-setting. You start directly with the development itself.',
      userPrompt: 'Summarize the key AI/tech development from this content in under 60 words. Must include: (1) the specific tool, model, or framework name, (2) what was announced, demonstrated, or released, (3) why it matters to AI practitioners. Start with the tool or model name. No intros, no filler.\n\n{transcript}',
    },
    {
      name: 'Financial Market Brief',
      description: 'Ultra-tight financial summary — specific ticker or sector, sentiment direction, and key catalyst. Under 60 words.',
      isDefault: false,
      sortOrder: 10,
      systemPrompt: 'You are a financial market analyst summarizing trading content for active investors. You are terse and precise. You name specific tickers, sectors, and catalysts. You never open with "In this video", "Today", or any scene-setting. You start directly with the ticker or market move.',
      userPrompt: 'Summarize the key market developments from this content in under 60 words. Must include: (1) specific tickers or sectors mentioned, (2) the sentiment for each (bullish/bearish/neutral), (3) the key catalyst or risk cited. Start with the most prominent ticker or sector. No intros, no filler.\n\n{transcript}',
    },
  ]

  // ── Research sources ───────────────────────────────────────────────────
  const RESEARCH_SOURCES = [
    // YouTube — AI 
    { name: 'AIAgentsStudio', slug: 'aiagentsstudio', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/aiagentsstudio' },
    { name: 'Nate Herk', slug: 'nateherk', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/nateherk' },
    { name: 'Intheworldofai', slug: 'intheworldofai', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/intheworldofai' },
    { name: 'AIBrainbox', slug: 'aibrainbox', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/aibrainbox' },
    { name: 'NetworkChuck', slug: 'networkchuck', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/networkchuck' },
    { name: 'WesRoth', slug: 'wesroth', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/wesroth' },
    { name: 'ManuAGI', slug: 'manuagi', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@manuagi' },
    { name: 'Realrobtheaiguy', slug: 'realrobtheaiguy', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@realrobtheaiguy' },
    { name: 'Mr. E Flow', slug: 'mr-e-flow', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@mreflow' },
    { name: 'GitHub Awesome', slug: 'github-awesome', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@GithubAwesome' },
    { name: 'The AI Search', slug: 'the-ai-search', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@theAIsearch' },
    { name: 'AI Labs', slug: 'ai-labs', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@AILABS-393' },
    { name: 'AI Code King', slug: 'ai-code-king', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@AICodeKing' },
    { name: 'Prompt Engineer', slug: 'prompt-engineer', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@PromptEngineer48' },
    { name: 'I Am AI Master', slug: 'i-am-ai-master', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@iamAImaster' },
    { name: 'Kittl Design', slug: 'kittl-design', category: 'ai', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@Kittldesign' },
    // YouTube — politics
    { name: 'Vaush', slug: 'vaush', category: 'politics', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@Vaush' },
    { name: 'Destiny', slug: 'destiny', category: 'politics', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@destiny' },
    // YouTube — financial
    { name: 'ZipTrader', slug: 'ziptrader', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@ZipTrader' },
    { name: 'Spencer Invests', slug: 'spencer-invests', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@SpencerInvests' },
    { name: 'Stock Moe', slug: 'stock-moe', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@StockMoe' },
    { name: 'Tom Nash TV', slug: 'tom-nash-tv', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@TomNashTV' },
    { name: 'Meet Kevin', slug: 'meet-kevin', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@MeetKevin' },
    // YouTube — tech
    { name: 'Fireship', slug: 'fireship', category: 'tech', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@Fireship' },
    { name: 'Theo', slug: 'theo', category: 'tech', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@t3dotgg' },
    { name: 'ThePrimeagen', slug: 'theprimeagen', category: 'tech', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@ThePrimeagen' },
    // YouTube — culture
    { name: 'Dr. Roy Casagranda', slug: 'dr-roy-casagranda', category: 'culture', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@DrRoyCasagranda' },
    { name: 'Channel 5', slug: 'channel-5', category: 'culture', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@Channel5YouTube' },
    // YouTube — additional financial
    { name: 'Heresy Financial', slug: 'heresy-financial', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@HeresyFinancial' },
    { name: 'WallStreetZen', slug: 'wallstreetzen', category: 'financial', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/@WallStreetZen' },
    // Reddit — financial
    { name: 'WallStreetBets', slug: 'wallstreetbets', category: 'financial', sourceType: 'reddit', sourceUrl: 'https://www.reddit.com/r/wallstreetbets' },
    { name: 'r/stocks', slug: 'r-stocks', category: 'financial', sourceType: 'reddit', sourceUrl: 'https://www.reddit.com/r/stocks' },
    // RSS — financial
    { name: 'Yahoo Finance', slug: 'yahoo-finance', category: 'financial', sourceType: 'rss', sourceUrl: 'https://finance.yahoo.com/rss/topstories' },
    { name: 'MarketWatch', slug: 'marketwatch', category: 'financial', sourceType: 'rss', sourceUrl: 'https://feeds.marketwatch.com/marketwatch/topstories' },
    // RSS — politics
    { name: 'NPR Politics', slug: 'npr-politics', category: 'politics', sourceType: 'rss', sourceUrl: 'https://feeds.npr.org/1014/rss.xml' },
    // RSS — tech
    { name: 'Hacker News', slug: 'hacker-news', category: 'tech', sourceType: 'rss', sourceUrl: 'https://news.ycombinator.com/rss' },
    { name: 'TechCrunch', slug: 'techcrunch', category: 'tech', sourceType: 'rss', sourceUrl: 'https://techcrunch.com/feed/' },
  ]

  console.log('\nSeeding research sources...')
  const sourceResult = await db.researchSource.createMany({
    data: RESEARCH_SOURCES.map(src => ({
      status: 'active',
      workspaceId: community.id,
      visibility: 'PUBLIC' as const,
      ...src,
    })),
    skipDuplicates: true,
  })
  console.log(`  ${sourceResult.count} sources created`)

  // Wire loops
  const ziptraderSource = await db.researchSource.findUnique({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'ziptrader' } },
  })
  const vaushSource = await db.researchSource.findUnique({
    where: { workspaceId_slug: { workspaceId: community.id, slug: 'vaush' } },
  })

  // Daily Market Brief is now multi-source aggregation — no loop
  await db.pipelineLoop.deleteMany({ where: { pipelineId: marketBriefPipeline.id } })

  if (ziptraderSource) {
    await db.pipelineLoop.upsert({
      where: { pipelineId: thesisPipeline.id },
      update: { sourceId: ziptraderSource.id },
      create: {
        pipelineId: thesisPipeline.id,
        loopType: 'research_feed',
        sourceId: ziptraderSource.id,
        cursorMode: 'new_since_cursor',
        variableMap: { context: 'content' },
        maxBatchSize: 10,
      },
    })
    console.log('  Investment Thesis loop wired to ZipTrader')
  }

  if (vaushSource) {
    await db.pipelineLoop.upsert({
      where: { pipelineId: politicalPipeline.id },
      update: { sourceId: vaushSource.id },
      create: {
        pipelineId: politicalPipeline.id,
        loopType: 'research_feed',
        sourceId: vaushSource.id,
        cursorMode: 'new_since_cursor',
        maxBatchSize: 5,
      },
    })
    console.log('  Political Commentary loop wired to Vaush')
  }

  // ── Library agents ─────────────────────────────────────────────────────
  console.log('\nSeeding library agents...')
  let created = 0
  let skipped = 0

  for (const agent of LIBRARY_AGENTS) {
    const agentHash = promptHash(agent.systemPrompt, agent.userPrompt, agent.outputTarget)
    const existing = await db.libraryAgent.findUnique({ where: { promptHash: agentHash } })
    if (!existing) {
      await db.libraryAgent.create({
        data: {
          uid: agent.uid,
          name: agent.name,
          description: agent.description,
          category: agent.category,
          tags: agent.tags,
          systemPrompt: agent.systemPrompt,
          userPrompt: agent.userPrompt,
          outputTarget: agent.outputTarget,
          outputFormat: agent.outputFormat,
          promptHash: agentHash,
          usageCount: 0,
        },
      })
      created++
    } else {
      skipped++
    }
  }
  console.log(`  ${created} created, ${skipped} already existed`)

  // ── Community prompts catalog ──────────────────────────────────────────
  console.log('\nSeeding community prompts...')
  let promptsCreated = 0
  let promptsUpdated = 0

  async function upsertCommunityPrompt(data: {
    name: string
    description?: string
    kind: 'TRANSFORMATIONAL' | 'CONTENT'
    category: string
    tags?: string[]
    systemPrompt: string
    userPrompt: string
    uid?: string
    outputTarget?: string
    outputFormat?: string
    sortOrder?: number
    isDefault?: boolean
  }) {
    const hash = catalogPromptHash(data.kind, data.systemPrompt, data.userPrompt, data.outputTarget)
    const slug = slugify(data.name)
    if (data.kind === 'CONTENT' && data.isDefault) {
      await db.prompt.updateMany({ where: { kind: 'CONTENT', isDefault: true }, data: { isDefault: false } })
    }
    const existing = await db.prompt.findUnique({ where: { promptHash: hash } })
    if (existing) {
      await db.prompt.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          tags: data.tags ?? [],
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          uid: data.uid,
          outputTarget: data.outputTarget,
          outputFormat: data.outputFormat,
          sortOrder: data.sortOrder ?? 0,
          isDefault: data.kind === 'CONTENT' ? (data.isDefault ?? false) : false,
          visibility: 'PUBLIC',
          workspaceId: community.id,
        },
      })
      promptsUpdated++
      return
    }

    const slugConflict = await db.prompt.findUnique({ where: { slug } })
    await db.prompt.create({
      data: {
        slug: slugConflict ? `${slug}-${hash.slice(0, 6)}` : slug,
        name: data.name,
        description: data.description,
        kind: data.kind,
        category: data.category,
        tags: data.tags ?? [],
        systemPrompt: data.systemPrompt,
        userPrompt: data.userPrompt,
        uid: data.uid,
        outputTarget: data.outputTarget,
        outputFormat: data.outputFormat ?? 'text',
        visibility: 'PUBLIC',
        workspaceId: community.id,
        promptHash: hash,
        sortOrder: data.sortOrder ?? 0,
        isDefault: data.kind === 'CONTENT' ? (data.isDefault ?? false) : false,
      },
    })
    promptsCreated++
  }

  for (const agent of LIBRARY_AGENTS) {
    await upsertCommunityPrompt({
      name: agent.name,
      description: agent.description,
      kind: 'TRANSFORMATIONAL',
      category: agent.category,
      tags: agent.tags,
      systemPrompt: agent.systemPrompt,
      userPrompt: agent.userPrompt,
      uid: agent.uid,
      outputTarget: agent.outputTarget,
      outputFormat: agent.outputFormat,
    })
  }

  for (const [index, summary] of SUMMARY_PROMPTS.entries()) {
    await upsertCommunityPrompt({
      name: summary.name,
      description: summary.description,
      kind: 'CONTENT',
      category: 'research',
      tags: ['summary', 'research'],
      systemPrompt: summary.systemPrompt,
      userPrompt: summary.userPrompt,
      sortOrder: summary.sortOrder ?? index,
      isDefault: summary.isDefault,
    })
  }

  const pipelineAgents = await db.pipelineAgent.findMany({
    where: { pipeline: { visibility: 'PUBLIC' } },
    include: { pipeline: { select: { name: true, slug: true } } },
  })
  for (const agent of pipelineAgents) {
    await upsertCommunityPrompt({
      name: `${agent.name} (${agent.pipeline.name})`,
      description: `From community pipeline "${agent.pipeline.name}"`,
      kind: 'TRANSFORMATIONAL',
      category: 'pipeline',
      tags: ['pipeline', agent.pipeline.slug],
      systemPrompt: agent.systemPrompt,
      userPrompt: agent.userPrompt,
      uid: agent.uid,
      outputTarget: agent.outputTarget,
      outputFormat: agent.outputFormat,
    })
  }

  console.log(`  ${promptsCreated} created, ${promptsUpdated} updated`)

  // ── Wire AI sources to AI Industry Brief as default summary prompt ─────
  console.log('\nWiring AI sources to AI Industry Brief prompt...')
  const aiIndustryBrief = await db.prompt.findFirst({
    where: { workspaceId: community.id, name: 'AI Industry Brief', kind: 'CONTENT' },
  })
  if (aiIndustryBrief) {
    const AI_SOURCE_SLUGS = [
      'aiagentsstudio', 'nateherk', 'intheworldofai', 'aibrainbox', 'networkchuck',
      'wesroth', 'manuagi', 'realrobtheaiguy', 'mr-e-flow', 'github-awesome',
      'the-ai-search', 'ai-labs', 'ai-code-king', 'prompt-engineer', 'i-am-ai-master',
      'kittl-design', 'fireship', 'theo', 'theprimeagen',
    ]
    const wiredCount = await db.researchSource.updateMany({
      where: { workspaceId: community.id, slug: { in: AI_SOURCE_SLUGS } },
      data: { defaultSummaryPromptId: aiIndustryBrief.id },
    })
    console.log(`  ${wiredCount.count} AI sources wired to AI Industry Brief`)
  }

  // ── Wire financial sources to Financial Market Brief as default summary prompt ──
  console.log('\nWiring financial sources to Financial Market Brief prompt...')
  const financialMarketBrief = await db.prompt.findFirst({
    where: { workspaceId: community.id, name: 'Financial Market Brief', kind: 'CONTENT' },
  })
  if (financialMarketBrief) {
    const FINANCE_SOURCE_SLUGS = [
      'ziptrader', 'spencer-invests', 'stock-moe', 'tom-nash-tv', 'meet-kevin',
      'heresy-financial', 'wallstreetzen', 'wallstreetbets', 'r-stocks',
      'yahoo-finance', 'marketwatch',
    ]
    const wiredFinance = await db.researchSource.updateMany({
      where: { workspaceId: community.id, slug: { in: FINANCE_SOURCE_SLUGS } },
      data: { defaultSummaryPromptId: financialMarketBrief.id },
    })
    console.log(`  ${wiredFinance.count} financial sources wired to Financial Market Brief`)
  }

  // ── Personal workspace starter fork ────────────────────────────────────
  console.log('\nForking starter pack into personal workspace...')
  const STARTER_FEED_SLUGS = [
    'ziptrader', 'vaush', 'fireship', 'wesroth',
    'hacker-news', 'techcrunch', 'npr-politics', 'wallstreetbets',
  ]

  const starterSources = await db.researchSource.findMany({
    where: { workspaceId: community.id, slug: { in: STARTER_FEED_SLUGS } },
  })

  let feedsForked = 0
  for (const source of starterSources) {
    const exists = await db.researchSource.findFirst({
      where: { workspaceId: personal.id, sourceUrl: source.sourceUrl },
    })
    if (!exists) {
      await db.researchSource.create({
        data: {
          name: source.name,
          slug: source.slug,
          category: source.category,
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          externalId: source.externalId,
          workspaceId: personal.id,
          visibility: 'PRIVATE',
          status: 'active',
        },
      })
      feedsForked++
    }
  }

  const contentPrompts = await db.prompt.findMany({
    where: { workspaceId: community.id, kind: 'CONTENT' },
  })

  let promptsForked = 0
  for (const prompt of contentPrompts) {
    const exists = await db.prompt.findFirst({
      where: { workspaceId: personal.id, name: prompt.name, kind: prompt.kind },
    })
    if (!exists) {
      const forkHash = createHash('sha256').update(`fork:${personal.id}:${prompt.id}`).digest('hex')
      await db.prompt.create({
        data: {
          name: prompt.name,
          slug: `${prompt.slug}-personal`,
          description: prompt.description,
          kind: prompt.kind,
          category: prompt.category,
          tags: prompt.tags,
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
          uid: prompt.uid,
          outputTarget: prompt.outputTarget,
          outputFormat: prompt.outputFormat,
          promptHash: forkHash,
          workspaceId: personal.id,
          visibility: 'PRIVATE',
          isDefault: prompt.isDefault,
          sortOrder: prompt.sortOrder,
        },
      })
      promptsForked++
    }
  }

  console.log(`  ${feedsForked} feeds forked, ${promptsForked} prompts forked`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
