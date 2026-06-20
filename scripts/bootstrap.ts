import { execSync } from 'child_process'
import { existsSync, copyFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')

function run(cmd: string, label: string) {
  console.log(`\n→ ${label}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
  console.log(`✓ ${label}`)
}

const envPath = resolve(root, '.env')
const envExample = resolve(root, '.env.example')
function syncEnvCopies() {
  for (const rel of ['packages/db/.env']) {
    const target = resolve(root, rel)
    copyFileSync(envPath, target)
    console.log(`   Synced .env → ${rel}`)
  }
}

if (!existsSync(envPath)) {
  copyFileSync(envExample, envPath)
  syncEnvCopies()
  console.log('\n⚠  .env created from .env.example')
  console.log('   Edit DATABASE_URL and OPENAI_API_KEY before continuing, then re-run bootstrap.\n')
  process.exit(0)
}

syncEnvCopies()

console.log('🚀 Bootstrapping AgentPress...\n')

run('pnpm install', 'Install dependencies')
run('pnpm --filter @project/db exec prisma generate', 'Generate Prisma client')
run('pnpm db:push', 'Push schema to database')
run('pnpm schedules:backfill', 'Backfill legacy pipeline schedules')
run('pnpm sdk:generate', 'Generate SDK types from OpenAPI spec')
run('pnpm db:seed', 'Seed development data')

console.log('\n✅  Bootstrap complete.')
console.log('   Run `pnpm dev` to start the app.')
console.log('   Web:  http://localhost:5173')
console.log('   API:  http://localhost:3001')
console.log('   Docs: http://localhost:3001/docs\n')
