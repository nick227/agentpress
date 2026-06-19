import { readFileSync } from 'fs'

let cachedWindowsHost: string | undefined | null = null

export function getWindowsHostIp(): string | undefined {
  if (cachedWindowsHost !== null) return cachedWindowsHost

  const fromEnv = process.env.WINDOWS_HOST_IP?.trim()
  if (fromEnv) {
    cachedWindowsHost = fromEnv
    return fromEnv
  }

  const inWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)
  if (!inWsl) {
    cachedWindowsHost = undefined
    return undefined
  }

  try {
    const resolv = readFileSync('/etc/resolv.conf', 'utf8')
    const match = resolv.match(/^nameserver\s+(\S+)/m)
    cachedWindowsHost = match?.[1]
    return cachedWindowsHost
  } catch {
    cachedWindowsHost = undefined
    return undefined
  }
}

export function resolveServerFetchUrl(url: string): string {
  const hostIp = getWindowsHostIp()
  if (!hostIp) return url

  return url
    .replace(/\/\/localhost\b/gi, `//${hostIp}`)
    .replace(/\/\/127\.0\.0\.1\b/g, `//${hostIp}`)
    .replace(/\/\/\[::1\]/gi, `//${hostIp}`)
}

export function wordpressReachabilityHint(originalUrl: string): string {
  const resolved = resolveServerFetchUrl(originalUrl)
  if (resolved === originalUrl) return ''
  return ` Server tried ${resolved} (WSL localhost rewrite). Set WINDOWS_HOST_IP in .env if that IP is wrong.`
}
