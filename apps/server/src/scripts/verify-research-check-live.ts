/**
 * Live verification against the dev database + YouTube.
 * Run: pnpm --filter server exec tsx --env-file=.env src/scripts/verify-research-check-live.ts
 */
import { db } from '@project/db'
import { ResearchService } from '../services/ResearchService.ts'
import { formatResearchCheckMessage } from '../services/researchCheckMessage.ts'

const svc = new ResearchService()

async function findZipTraderSource() {
  return db.researchSource.findFirst({
    where: { OR: [{ slug: 'ziptrader' }, { name: { contains: 'ZipTrader' } }] },
    include: {
      items: { orderBy: { publishedAt: 'desc' }, take: 1 },
    },
  })
}

async function main() {
  console.log('\nLive research check verification — ZipTrader\n')

  const source = await findZipTraderSource()
  if (!source) {
    console.log('  ✗ No ZipTrader research source in DB. Run pnpm db:seed first.\n')
    process.exit(1)
  }

  console.log(`  Source: ${source.name} (${source.id})`)
  const latest = source.items[0]
  if (!latest) {
    console.log('  ✗ No items yet — run an initial check from the UI first.\n')
    process.exit(1)
  }

  console.log(`  Latest item: "${latest.title}" (${latest.externalId})`)
  console.log(`  Before: contentStatus=${latest.contentStatus ?? 'none'}, hasContent=${Boolean(latest.content?.trim())}\n`)

  // Case 1 setup: clear transcript so check must re-fetch
  await db.researchItem.update({
    where: { id: latest.id },
    data: {
      content: null,
      contentStatus: 'error',
      contentErrorReason: 'Cleared for verification — should re-fetch on check',
    },
  })
  console.log('  Case 1: cleared transcript on existing item, running check…')

  const result1 = await svc.checkLatest(source.id)
  const msg1 = formatResearchCheckMessage(source.sourceType, result1)
  const after1 = await db.researchItem.findUnique({ where: { id: latest.id } })

  console.log(`    contentChecked: ${result1.latest?.contentChecked}`)
  console.log(`    fetch attempted (updatedCount): ${result1.updatedCount}`)
  console.log(`    message: ${msg1}`)
  console.log(`    after: contentStatus=${after1?.contentStatus}, chars=${after1?.content?.length ?? 0}`)

  const case1Pass = result1.latest?.contentChecked === true
  console.log(case1Pass ? '    ✓ Case 1 PASS — transcript fetch attempted\n' : '    ✗ Case 1 FAIL\n')

  // Report cases 2/3 based on actual YouTube response
  if (after1?.content?.trim()) {
    console.log('  Case 3: transcript available')
    console.log(`    ✓ content populated (${after1.content.length} chars)`)
    console.log(`    message includes "transcript fetched": ${msg1.includes('transcript fetched') || msg1.includes('transcript on file')}\n`)
  } else if (after1?.contentStatus === 'disabled' || after1?.contentStatus === 'unavailable') {
    console.log('  Case 2: captions disabled/unavailable on live video')
    console.log(`    contentStatus: ${after1.contentStatus}`)
    console.log(`    message: ${msg1}`)
    const case2Pass = msg1.toLowerCase().includes('transcript unavailable') || msg1.toLowerCase().includes('captions')
    console.log(case2Pass ? '    ✓ Case 2 PASS\n' : '    ✗ Case 2 FAIL\n')
  } else {
    console.log(`  Live video returned status: ${after1?.contentStatus ?? 'unknown'}`)
    console.log(`  Message: ${msg1}\n`)
  }

  process.exit(case1Pass ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
