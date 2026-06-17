import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Create owner user
  const hash = await bcrypt.hash('password123', 12)
  const user = await db.user.upsert({
    where: { email: 'admin@agentpress.local' },
    update: {},
    create: { email: 'admin@agentpress.local', passwordHash: hash, role: 'OWNER' },
  })

  // Create a demo account
  const account = await db.account.upsert({
    where: { slug: 'demo-blog' },
    update: {},
    create: {
      name: 'Demo Blog',
      slug: 'demo-blog',
      category: 'Content',
      description: 'A demo account for testing pipelines.',
    },
  })

  // Create a demo pipeline
  const pipeline = await db.pipeline.upsert({
    where: { accountId_slug: { accountId: account.id, slug: 'seo-blog-post' } },
    update: {},
    create: {
      accountId: account.id,
      name: 'SEO Blog Post',
      slug: 'seo-blog-post',
      description: 'Generate a full SEO-optimized blog post from a topic.',
      status: 'active',
      dryRun: true,
      scheduleMode: 'manual',
    },
  })

  // Variables
  await db.pipelineVariable.deleteMany({ where: { pipelineId: pipeline.id } })
  await db.pipelineVariable.createMany({
    data: [
      { pipelineId: pipeline.id, key: 'topic', label: 'Topic', type: 'text', required: true, exampleValue: 'The benefits of content marketing', sortOrder: 0 },
      { pipelineId: pipeline.id, key: 'tone', label: 'Tone', type: 'text', required: false, defaultValue: 'professional', exampleValue: 'professional', sortOrder: 1 },
      { pipelineId: pipeline.id, key: 'word_count', label: 'Word count', type: 'number', required: false, defaultValue: '1200', sortOrder: 2 },
    ],
  })

  // Agents
  await db.pipelineAgent.deleteMany({ where: { pipelineId: pipeline.id } })
  await db.pipelineAgent.createMany({
    data: [
      {
        pipelineId: pipeline.id,
        uid: 'researcher',
        name: 'Researcher',
        systemPrompt: 'You are an expert content researcher. Identify key points, data, and subtopics for a blog post.',
        userPrompt: 'Research the following topic and provide an outline of key points to cover:\n\nTopic: {topic}\nTone: {tone}',
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 0,
      },
      {
        pipelineId: pipeline.id,
        uid: 'title_writer',
        name: 'Title Writer',
        systemPrompt: 'You are an SEO copywriter. Write compelling, keyword-rich blog post titles.',
        userPrompt: 'Based on this research, write an SEO-optimized title for a blog post:\n\n{agents.researcher.output}\n\nReturn only the title, no quotes.',
        outputTarget: 'title',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 1,
      },
      {
        pipelineId: pipeline.id,
        uid: 'body_writer',
        name: 'Body Writer',
        systemPrompt: 'You are a professional blog writer. Write comprehensive, engaging blog posts in {tone} tone.',
        userPrompt: 'Write a full blog post of approximately {word_count} words based on this outline:\n\n{agents.researcher.output}\n\nTitle: {agents.title_writer.output}\n\nUse markdown formatting.',
        outputTarget: 'body',
        outputFormat: 'markdown',
        enabled: true,
        sortOrder: 2,
      },
      {
        pipelineId: pipeline.id,
        uid: 'excerpt_writer',
        name: 'Excerpt Writer',
        systemPrompt: 'You write concise blog post excerpts for SEO and social sharing.',
        userPrompt: 'Write a 2-sentence excerpt for this blog post:\n\nTitle: {agents.title_writer.output}\n\nBody: {agents.body_writer.output}',
        outputTarget: 'excerpt',
        outputFormat: 'text',
        enabled: true,
        sortOrder: 3,
      },
    ],
  })

  console.log('✓ Seed complete')
  console.log(`  User: admin@agentpress.local / password123`)
  console.log(`  Account: Demo Blog`)
  console.log(`  Pipeline: SEO Blog Post (4 agents)`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
