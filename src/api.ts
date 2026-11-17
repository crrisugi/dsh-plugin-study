import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BlueprintStore } from './blueprint-store.js'
import { API_PREFIX } from './contract.js'
import { enforceTrustFence } from './trust-fence.js'

export interface WebServerLike {
  register(route: {
    kind: 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  }): () => void
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

export function registerStudyApi(
  webServer: WebServerLike,
  deps: {
    store: BlueprintStore
    resolveSessionCwd?: ((sessionId: string) => string | undefined) | undefined
  },
): () => void {
  return webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      if (!enforceTrustFence(req, res)) return

      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } })
        return
      }

      const rawUrl = req.url ?? API_PREFIX
      const parsed = new URL(rawUrl, 'http://localhost')
      const subPath = parsed.pathname.startsWith(API_PREFIX)
        ? parsed.pathname.slice(API_PREFIX.length) || '/'
        : parsed.pathname

      const sessionId = parsed.searchParams.get('sessionId') ?? undefined
      const cwd = sessionId ? deps.resolveSessionCwd?.(sessionId) ?? deps.store.getSessionCwd(sessionId) : undefined

      if (subPath === '/overview' || subPath === '/') {
        const blueprints = await deps.store.listBlueprints({ sessionId, cwd })
        sendJson(res, 200, {
          ok: true,
          sessionId: sessionId ?? null,
          blueprints,
        })
        return
      }

      if (subPath === '/card') {
        const key = parsed.searchParams.get('key') ?? ''
        const archivedName = parsed.searchParams.get('name') ?? ''
        const detail = await deps.store.readArchivedCard({ key, archivedName, cwd, sessionId })
        if (!detail) {
          sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Card not found' } })
          return
        }
        sendJson(res, 200, { ok: true, detail })
        return
      }

      if (subPath === '/svg') {
        const key = parsed.searchParams.get('key') ?? ''
        const assetName = parsed.searchParams.get('name') ?? ''
        const svg = await deps.store.readSvgAsset({ key, assetName, cwd, sessionId })
        if (!svg) {
          sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'SVG asset not found' } })
          return
        }
        sendJson(res, 200, { ok: true, name: assetName, svg })
        return
      }

      sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } })
    },
  })
}
