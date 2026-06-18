import { OpenAIService } from '../services/OpenAIService'

const ai = new OpenAIService()

async function step(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  process.stdout.write(`  ${label}... `)
  try {
    const result = await fn()
    console.log('✓')
    return result
  } catch (err: any) {
    console.log(`✗  ${err.message}`)
    return null
  }
}

const SAMPLE_TRANSCRIPT = `
Hey everyone, welcome back. Today we're talking about why universal basic income is actually a lot more nuanced
than people think. A lot of folks on the left just assume it's a good idea, and a lot of folks on the right
assume it's socialism. But the truth is there are like fifteen different versions of UBI and they have
wildly different implications. Some versions are funded by taxing wealth, some replace existing welfare,
some are pilot programs in cities. The Finland experiment showed modest improvements in wellbeing but no
significant employment effects. The Stockton SEED program showed people mostly spent the money on food and
utilities. The devil is really in the details — who gets it, how much, what it replaces, and how it's funded
completely changes whether it's progressive or regressive policy. I think the left needs to be way more precise
about which version they're advocating for because right now it's just vibes.
`.trim()

async function main() {
  console.log('\nOpenAI smoke test\n')

  const text = await step(
    'generateText (gpt-4o) — one sentence response',
    () => ai.generateText(
      'You are a helpful assistant. Reply in exactly one sentence.',
      'What is 2 + 2?',
    ).then((r) => {
      if (!r) throw new Error('empty response')
      console.log(`     "${r.trim()}"`)
      return r
    }),
  )

  const summary = await step(
    'Research summarizer path (gpt-4o-mini) — transcript → <1000 char summary',
    () => ai.generateText(
      'You are a concise content summarizer. Summarize the provided YouTube transcript in under 1000 characters. Focus on the key insights, main points, and actionable takeaways. Be direct and informative.',
      `Transcript:\n\n${SAMPLE_TRANSCRIPT}`,
    ).then((r) => {
      if (!r) throw new Error('empty response')
      const trimmed = r.slice(0, 1000)
      console.log(`     ${trimmed.length} chars`)
      console.log(`     "${trimmed.slice(0, 150)}…"`)
      return trimmed
    }),
  )

  console.log()
  const allPassed = text && summary
  if (allPassed) {
    console.log('All steps passed ✓\n')
  } else {
    console.log('Some steps failed — check OPENAI_API_KEY in .env\n')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
