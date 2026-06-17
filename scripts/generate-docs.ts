import { load } from 'js-yaml'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
const specPath = resolve(root, 'packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as any

mkdirSync(resolve(root, 'docs'), { recursive: true })

// API reference
const lines = ['# API Reference\n', `Generated from openapi.yaml\n`]
for (const [path, pathItem] of Object.entries<any>(spec.paths ?? {})) {
  for (const [method, op] of Object.entries<any>(pathItem)) {
    if (!op.operationId) continue
    lines.push(`## \`${method.toUpperCase()} ${path}\``)
    lines.push(`**operationId:** \`${op.operationId}\`  `)
    if (op.summary) lines.push(`**Summary:** ${op.summary}  `)
    const auth = Array.isArray(op.security) && op.security.length === 0 ? 'Public' : 'Requires auth'
    lines.push(`**Auth:** ${auth}\n`)
  }
}
writeFileSync(resolve(root, 'docs/api-reference.md'), lines.join('\n'))
console.log('✓ docs/api-reference.md')

// Env vars
const envExample = readFileSync(resolve(root, '.env.example'), 'utf-8')
const envLines = ['# Environment Variables\n']
for (const line of envExample.split('\n')) {
  if (line.startsWith('#')) { envLines.push(line.replace(/^# ?/, '### ')); continue }
  if (!line.trim()) { envLines.push(''); continue }
  const [key] = line.split('=')
  if (key) envLines.push(`- \`${key.trim()}\``)
}
writeFileSync(resolve(root, 'docs/env-vars.md'), envLines.join('\n'))
console.log('✓ docs/env-vars.md')

console.log('\nDone.')
