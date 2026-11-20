import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UpdateInfo } from './contract.js'

export const REPO_SLUG = 'crrisugi/dsh-plugin-study'
export const RELEASES_LATEST_URL = `https://github.com/${REPO_SLUG}/releases/latest`
export const RELEASES_PAGE_URL = `https://github.com/${REPO_SLUG}/releases`
export const NPM_DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/dsh-plugin-study/dist-tags'

export const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000
export const FAILURE_TTL_MS = 6 * 60 * 60 * 1000
export const HTTP_TIMEOUT_MS = 2500
export const STARTUP_DELAY_MS = 3000

const SEMVER_RE = /^[vV]?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
const TAG_PATH_RE = /\/releases\/tag\/([^/?#]+)/

interface ParsedSemver {
  readonly major: number
  readonly minor: number
  readonly patch: number
  readonly pre: readonly (number | string)[]
}

interface UpdateCacheRecord {
  lastCheckedAt?: number
  lastStatus?: 'ok' | 'error'
  latestVersion?: string | null
  releaseUrl?: string
}

export interface UpdateCheckerOptions {
  readonly currentVersion?: string | undefined
  readonly cachePath?: string | undefined
  readonly fetchFn?: typeof fetch | undefined
  readonly env?: NodeJS.ProcessEnv | undefined
  readonly now?: (() => number) | undefined
  readonly timeoutMs?: number | undefined
  readonly successTtlMs?: number | undefined
  readonly failureTtlMs?: number | undefined
}

function isTruthyEnv(val: string | undefined): boolean {
  if (!val) return false
  return ['1', 'true', 'yes', 'on'].includes(val.trim().toLowerCase())
}

export function isUpdateCheckDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isTruthyEnv(env['DSH_STUDY_NO_UPDATE_CHECK']) ||
    isTruthyEnv(env['NO_UPDATE_NOTIFIER']) ||
    isTruthyEnv(env['CI']) ||
    isTruthyEnv(env['GITHUB_ACTIONS'])
  )
}

export function parseSemver(ver: string): ParsedSemver | null {
  const match = SEMVER_RE.exec(ver.trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3] ?? '0')
  const preRaw = match[4] ?? ''
  const pre = preRaw
    ? preRaw.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : []
  return { major, minor, patch, pre }
}

export function normalizeVersion(ver: string): string {
  return ver.trim().replace(/^[vV]/, '')
}

export function isStrictlyNewer(candidate: string, current: string): boolean {
  const cand = parseSemver(candidate)
  const curr = parseSemver(current)
  if (!cand || !curr) return false
  if (cand.major !== curr.major) return cand.major > curr.major
  if (cand.minor !== curr.minor) return cand.minor > curr.minor
  if (cand.patch !== curr.patch) return cand.patch > curr.patch
  if (curr.pre.length === 0) return false
  if (cand.pre.length === 0) return true
  const maxLen = Math.max(cand.pre.length, curr.pre.length)
  for (let i = 0; i < maxLen; i += 1) {
    const a = cand.pre[i]
    const b = curr.pre[i]
    if (a === undefined) return false
    if (b === undefined) return true
    if (a === b) continue
    if (typeof a === 'number' && typeof b === 'number') return a > b
    if (typeof a === 'number') return false
    if (typeof b === 'number') return true
    return a > b
  }
  return false
}

export function extractTagFromLocation(location: string | null | undefined): string | null {
  if (!location) return null
  const match = TAG_PATH_RE.exec(location.trim())
  if (!match || !match[1]) return null
  const tag = match[1].trim()
  return parseSemver(tag) ? tag : null
}

export function resolveDefaultCachePath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = os.homedir(),
): string {
  const override = env['DSH_STUDY_UPDATE_CACHE_PATH']?.trim()
  if (override) return override
  const base =
    platform === 'win32'
      ? env['LOCALAPPDATA']?.trim() || path.join(homeDir, 'AppData', 'Local')
      : env['XDG_CACHE_HOME']?.trim() || path.join(homeDir, '.cache')
  return path.join(base, 'dsh-plugin-study', 'update-check.json')
}

export function readPackageVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const pkgPath = path.resolve(here, '..', 'package.json')
    const raw = fs.readFileSync(pkgPath, 'utf-8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    if (typeof parsed.version === 'string' && parseSemver(parsed.version)) {
      return normalizeVersion(parsed.version)
    }
  } catch {
    // Ignore read/parse errors and return fallback version
  }
  return '0.0.0'
}

export class UpdateChecker {
  private readonly currentVersion: string
  private readonly cachePath: string
  private readonly fetchFn: typeof fetch
  private readonly env: NodeJS.ProcessEnv
  private readonly now: () => number
  private readonly timeoutMs: number
  private readonly successTtlMs: number
  private readonly failureTtlMs: number
  private status: UpdateInfo

  constructor(options: UpdateCheckerOptions = {}) {
    this.env = options.env ?? process.env
    this.now = options.now ?? (() => Date.now())
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? HTTP_TIMEOUT_MS
    this.successTtlMs = options.successTtlMs ?? SUCCESS_TTL_MS
    this.failureTtlMs = options.failureTtlMs ?? FAILURE_TTL_MS
    this.currentVersion = options.currentVersion ? normalizeVersion(options.currentVersion) : readPackageVersion()
    this.cachePath = options.cachePath ?? resolveDefaultCachePath(this.env)
    this.status = {
      currentVersion: this.currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: RELEASES_PAGE_URL,
      checkedAt: null,
    }
  }

  getStatus(): UpdateInfo {
    return this.status
  }

  private applyCacheRecord(record: UpdateCacheRecord): void {
    const latest = typeof record.latestVersion === 'string' && parseSemver(record.latestVersion)
      ? normalizeVersion(record.latestVersion)
      : null
    const checkedAt = typeof record.lastCheckedAt === 'number' && Number.isFinite(record.lastCheckedAt)
      ? new Date(record.lastCheckedAt).toISOString()
      : null
    this.status = {
      currentVersion: this.currentVersion,
      latestVersion: latest,
      updateAvailable: latest ? isStrictlyNewer(latest, this.currentVersion) : false,
      releaseUrl: typeof record.releaseUrl === 'string' && record.releaseUrl ? record.releaseUrl : RELEASES_PAGE_URL,
      checkedAt,
    }
  }

  private async readCache(): Promise<UpdateCacheRecord | null> {
    try {
      const raw = await fsp.readFile(this.cachePath, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        return parsed as UpdateCacheRecord
      }
    } catch {
      // Cache absent or unreadable
    }
    return null
  }

  private async writeCache(record: UpdateCacheRecord): Promise<void> {
    try {
      await fsp.mkdir(path.dirname(this.cachePath), { recursive: true })
      const tmp = `${this.cachePath}.${process.pid}.${this.now()}.tmp`
      await fsp.writeFile(tmp, JSON.stringify(record, null, 2), 'utf-8')
      await fsp.rename(tmp, this.cachePath)
    } catch {
      // Fail-open when cache directory is read-only
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  private async probeGitHubRedirect(): Promise<{ latestVersion: string; releaseUrl: string } | null> {
    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const res = await this.fetchWithTimeout(RELEASES_LATEST_URL, {
          method,
          redirect: 'manual',
          headers: { 'user-agent': 'dsh-plugin-study-update-check/1.0' },
        })
        if (res.status >= 300 && res.status < 400) {
          const tag = extractTagFromLocation(res.headers.get('location'))
          if (tag) {
            return {
              latestVersion: normalizeVersion(tag),
              releaseUrl: `${RELEASES_PAGE_URL}/tag/${tag}`,
            }
          }
          return null
        }
        if (res.status === 405 && method === 'HEAD') {
          continue
        }
        return null
      } catch {
        return null
      }
    }
    return null
  }

  private async probeNpmDistTags(): Promise<{ latestVersion: string; releaseUrl: string } | null> {
    try {
      const res = await this.fetchWithTimeout(NPM_DIST_TAGS_URL, {
        method: 'GET',
        headers: { accept: 'application/json', 'user-agent': 'dsh-plugin-study-update-check/1.0' },
      })
      if (!res.ok) return null
      const body = (await res.json()) as { latest?: unknown }
      if (typeof body.latest === 'string' && parseSemver(body.latest)) {
        const ver = normalizeVersion(body.latest)
        return {
          latestVersion: ver,
          releaseUrl: RELEASES_PAGE_URL,
        }
      }
    } catch {
      // Fail-open on network/parse error
    }
    return null
  }

  async loadFromCache(): Promise<void> {
    const cached = await this.readCache()
    if (cached) {
      this.applyCacheRecord(cached)
    }
  }

  async checkNow(force = false): Promise<UpdateInfo> {
    if (isUpdateCheckDisabled(this.env)) {
      return this.status
    }
    const cached = await this.readCache()
    const nowMs = this.now()
    if (!force && cached && typeof cached.lastCheckedAt === 'number') {
      const ttl = cached.lastStatus === 'ok' ? this.successTtlMs : this.failureTtlMs
      if (nowMs - cached.lastCheckedAt < ttl) {
        this.applyCacheRecord(cached)
        return this.status
      }
    }

    const remote = (await this.probeGitHubRedirect()) ?? (await this.probeNpmDistTags())
    const record: UpdateCacheRecord = remote
      ? {
          lastCheckedAt: nowMs,
          lastStatus: 'ok',
          latestVersion: remote.latestVersion,
          releaseUrl: remote.releaseUrl,
        }
      : {
          lastCheckedAt: nowMs,
          lastStatus: 'error',
          latestVersion: cached?.latestVersion ?? null,
          releaseUrl: cached?.releaseUrl ?? RELEASES_PAGE_URL,
        }
    await this.writeCache(record)
    this.applyCacheRecord(record)
    return this.status
  }

  scheduleBackgroundCheck(delayMs = STARTUP_DELAY_MS): () => void {
    if (isUpdateCheckDisabled(this.env)) {
      return () => {}
    }
    void this.loadFromCache()
    const timer = setTimeout(() => {
      void this.checkNow(false)
    }, delayMs)
    timer.unref?.()
    return () => clearTimeout(timer)
  }
}
