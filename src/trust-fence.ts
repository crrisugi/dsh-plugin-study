import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const val = headers[name]
  if (typeof val === 'string') return val
  if (Array.isArray(val) && val.length > 0) return val[0]
  return undefined
}

function stripPort(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase()
  if (trimmed.startsWith('[')) {
    const closeIdx = trimmed.indexOf(']')
    return closeIdx >= 0 ? trimmed.slice(0, closeIdx + 1) : trimmed
  }
  const colonIdx = trimmed.indexOf(':')
  return colonIdx >= 0 ? trimmed.slice(0, colonIdx) : trimmed
}

export function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase()
  if (lower === 'localhost' || lower === '[::1]' || lower === '::1') {
    return true
  }
  const parts = lower.split('.')
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  )
}

export function isTrustedApiRequest(req: Pick<IncomingMessage, 'headers'>): boolean {
  const rawHost = header(req.headers, 'host')
  if (!rawHost || !isLoopbackHostname(stripPort(rawHost))) {
    return false
  }

  const fetchSite = header(req.headers, 'sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false
  }

  const origin = header(req.headers, 'origin')
  if (origin) {
    try {
      const url = new URL(origin)
      if (!isLoopbackHostname(url.hostname)) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

export function enforceTrustFence(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isTrustedApiRequest(req)) {
    res.statusCode = 403
    res.end()
    return false
  }
  return true
}
