import {
  API_PREFIX,
  type CardDetailResponse,
  type OverviewResponse,
  type SvgPreviewResponse,
} from '../contract.js'

const TIMEOUT_MS = 8000

async function getJson<T>(pathWithQuery: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_PREFIX}${pathWithQuery}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    const body = (await res.json()) as { ok?: boolean; error?: { message?: string } }
    if (!res.ok || body.ok === false) {
      throw new Error(body.error?.message ?? `HTTP ${res.status}`)
    }
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

export function fetchStudyOverview(sessionId?: string): Promise<OverviewResponse> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return getJson<OverviewResponse>(`/overview${qs}`)
}

export function fetchArchivedCard(opts: {
  key: string
  name: string
  sessionId?: string | undefined
}): Promise<CardDetailResponse> {
  const params = new URLSearchParams({ key: opts.key, name: opts.name })
  if (opts.sessionId) params.set('sessionId', opts.sessionId)
  return getJson<CardDetailResponse>(`/card?${params.toString()}`)
}

export function fetchSvgPreview(opts: {
  key: string
  name: string
  sessionId?: string | undefined
}): Promise<SvgPreviewResponse> {
  const params = new URLSearchParams({ key: opts.key, name: opts.name })
  if (opts.sessionId) params.set('sessionId', opts.sessionId)
  return getJson<SvgPreviewResponse>(`/svg?${params.toString()}`)
}
