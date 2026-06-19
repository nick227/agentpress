import { execFile, execFileSync } from 'child_process'
import { mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import type { WordPressCredentials } from './wordpressMediaShared'
import { mediaMimeType, sanitizeMediaFilename } from './wordpressMediaShared'

const execFileAsync = promisify(execFile)

export function isWsl(): boolean {
  return Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)
}

function wpUploadTempDir(): string {
  const base = process.env.WP_UPLOAD_TMP?.trim()
    || (isWsl()
      ? join(process.cwd(), '.wp-upload-tmp')
      : join(process.cwd(), 'outputs', '.wp-upload-tmp'))
  mkdirSync(base, { recursive: true })
  return base
}

function toCurlFilePath(absPath: string, binary: string): string {
  if (binary === 'curl.exe') {
    const wslMatch = absPath.match(/^\/mnt\/([a-z])\/(.*)$/i)
    if (wslMatch?.[1] && wslMatch[2] !== undefined) {
      return `${wslMatch[1].toUpperCase()}:/${wslMatch[2].replace(/\\/g, '/')}`
    }
    return absPath.replace(/\\/g, '/')
  }
  return absPath
}

function curlBinary(): string {
  if (!isWsl()) return 'curl'
  try {
    execFileSync('which', ['curl'], { stdio: 'ignore' })
    return 'curl'
  } catch {
    return 'curl.exe'
  }
}

function uploadSizeError(stdout: string, stderr: string): string | undefined {
  const text = `${stdout}\n${stderr}`
  if (text.includes('413') || /entity too large/i.test(text)) {
    return 'WordPress host rejected the upload (413 Request Entity Too Large). '
      + 'AgentPress compresses images automatically; raise the host client_max_body_size or WORDPRESS_MAX_UPLOAD_BYTES.'
  }
  if (stderr.includes('Empty reply from server')) {
    return 'WordPress closed the connection during upload (often a body-size limit on the host).'
  }
  return undefined
}

export async function uploadMediaViaCurl(
  url: string,
  credentials: WordPressCredentials,
  imageBuffer: Uint8Array,
  filename: string,
  meta?: { alt?: string; caption?: string; title?: string; contentType?: string },
): Promise<{ id: number; url: string }> {
  const safeFilename = sanitizeMediaFilename(filename)
  const contentType = meta?.contentType ?? mediaMimeType(safeFilename)
  const tempPath = join(wpUploadTempDir(), `${randomBytes(8).toString('hex')}-${safeFilename}`)
  writeFileSync(tempPath, Buffer.from(imageBuffer))

  const curl = curlBinary()
  const args = [
    '-s', '-S',
    '-X', 'POST',
    url,
    '-u', `${credentials.username}:${credentials.appPassword}`,
    '-H', 'User-Agent: AgentPress/1.0',
    '-F', `file=@${toCurlFilePath(tempPath, curl)};type=${contentType}`,
  ]
  if (meta?.alt) args.push('-F', `alt_text=${meta.alt}`)
  if (meta?.caption) args.push('-F', `caption=${meta.caption}`)
  if (meta?.title) args.push('-F', `title=${meta.title}`)

  try {
    const { stdout, stderr } = await execFileAsync(curl, args, {
      maxBuffer: 16 * 1024 * 1024,
    })
    const sizeHint = uploadSizeError(stdout, stderr ?? '')
    if (sizeHint) throw new Error(sizeHint)
    if (stderr?.trim()) {
      throw new Error(stderr.trim())
    }
    const data = JSON.parse(stdout) as {
      id?: number
      source_url?: string
      guid?: { rendered?: string }
      code?: string
      message?: string
    }
    if (!data.id) {
      throw new Error(data.message ?? stdout.slice(0, 300))
    }
    return {
      id: data.id,
      url: data.source_url ?? data.guid?.rendered ?? '',
    }
  } catch (err) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string }
    const hint = uploadSizeError(execErr.stdout ?? '', execErr.stderr ?? '')
    if (hint) throw new Error(hint)
    throw err
  } finally {
    try {
      unlinkSync(tempPath)
    } catch {
      // ignore temp cleanup errors
    }
  }
}

export function shouldUseCurlFallback(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const cause = (err as Error & { cause?: { code?: string } }).cause
  const code = cause?.code ?? ''
  return err.message.includes('fetch failed')
    || code === 'UND_ERR_SOCKET'
    || code === 'ECONNRESET'
    || code === 'ETIMEDOUT'
}
