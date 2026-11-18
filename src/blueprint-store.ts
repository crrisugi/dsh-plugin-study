import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { BlueprintCardItem, BlueprintView, CardDetailView, CardStatus, ProbeStatus } from './contract.js'

export interface SyncBlueprintInput {
  readonly sessionId: string
  readonly topicTitle: string
  readonly material?: string | undefined
  readonly notesDir?: string | undefined
  readonly depthMode: string
  readonly coreProblem: string
  readonly prerequisites?: readonly string[] | undefined
  readonly toyExampleRange?: string | undefined
  readonly toyExampleValues?: string | undefined
  readonly currentCardId?: string | null | undefined
  readonly cards: readonly {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly isCore?: boolean | undefined
    readonly status?: CardStatus | undefined
    readonly probeStatus?: ProbeStatus | undefined
    readonly probeReason?: string | undefined
    readonly archivedName?: string | undefined
  }[]
}

interface SessionBlueprintState {
  view: BlueprintView
  notesDir?: string | undefined
  svgMap: Map<string, string>
  cardMarkdownMap: Map<string, { title: string; markdown: string }>
}

const MAX_SESSIONS = 64

export function isSafeSingleSegment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return false
  return !/[\\/\0:]/.test(segment)
}

export function resolveSafeRelativeDir(
  cwd: string,
  relDir: string,
): { absDir: string; relPosix: string } | null {
  const trimmed = relDir.trim()
  if (!trimmed || /[\0:]/.test(trimmed) || path.isAbsolute(trimmed)) {
    return null
  }
  const absCwd = path.resolve(cwd)
  const absDir = path.resolve(absCwd, trimmed)
  const rel = path.relative(absCwd, absDir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null
  }
  return { absDir, relPosix: rel.replace(/\\/g, '/') }
}

export function extractSvgRefs(markdown: string): string[] {
  const svgRefs: string[] = []
  const re = /!\[[^\]]*\]\((?:assets\/|\.\/assets\/)([a-zA-Z0-9_\u4e00-\u9fa5.-]+\.svg)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    if (m[1] && isSafeSingleSegment(m[1]) && !svgRefs.includes(m[1])) {
      svgRefs.push(m[1])
    }
  }
  return svgRefs
}

function normalizeNotesDirInput(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let cleaned = raw.trim().replace(/\\/g, '/')
  while (cleaned.startsWith('./')) cleaned = cleaned.slice(2)
  cleaned = cleaned.replace(/\/+$/, '')
  if (!cleaned || /[\0:]/.test(cleaned) || cleaned.startsWith('/')) {
    return undefined
  }
  const parts = cleaned.split('/')
  if (parts.some((p) => !p || p === '.' || p === '..')) {
    return undefined
  }
  return parts.join('/')
}

function normalizeCardId(raw: string): string {
  const m = /(\d+)/.exec(raw)
  if (!m?.[1]) return raw.trim()
  return `卡 ${m[1].padStart(2, '0')}`
}

export function parseBlueprintMarkdown(
  markdown: string,
  opts: {
    key: string
    fallbackTopic: string
    archivedFiles: readonly string[]
    svgAssets: readonly string[]
    updatedAt: string
  },
): BlueprintView {
  const lines = markdown.split(/\r?\n/)
  let topicTitle = opts.fallbackTopic
  let material = ''
  let depthMode = '标准推演'
  let coreProblem = ''
  const prerequisites: string[] = []
  let toyExampleRange = ''
  let toyExampleValues = ''
  const cards: BlueprintCardItem[] = []

  const h1 = lines.find((l) => l.startsWith('# '))
  if (h1) {
    const idx = h1.indexOf('：')
    const colonIdx = idx >= 0 ? idx : h1.indexOf(':')
    topicTitle = (colonIdx >= 0 ? h1.slice(colonIdx + 1) : h1.replace(/^#\s*/, '')).trim() || opts.fallbackTopic
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) {
      const matMatch = /\*\*学习材料\*\*[：:]\s*([^｜|]+)/.exec(trimmed)
      if (matMatch?.[1]) material = matMatch[1].trim()
      const depthMatch = /\*\*默认深度\*\*[：:]\s*(.+)$/.exec(trimmed)
      if (depthMatch?.[1]) depthMode = depthMatch[1].trim()
    } else if (/^-\s*\*\*核心问题\*\*[：:]/.test(trimmed)) {
      coreProblem = trimmed.replace(/^-\s*\*\*核心问题\*\*[：:]\s*/, '').trim()
    } else if (/^-\s*\*\*先直接拿来用的前提\*\*[：:]/.test(trimmed)) {
      const rest = trimmed.replace(/^-\s*\*\*先直接拿来用的前提\*\*[：:]\s*/, '').trim()
      if (rest) prerequisites.push(rest)
    } else if (/^-\s*\*\*最小输入与范围设定\*\*[：:]/.test(trimmed)) {
      toyExampleRange = trimmed.replace(/^-\s*\*\*最小输入与范围设定\*\*[：:]\s*/, '').trim()
    } else if (/^-\s*\*\*固定代入的具体数值\*\*[：:]/.test(trimmed)) {
      toyExampleValues = trimmed.replace(/^-\s*\*\*固定代入的具体数值\*\*[：:]\s*/, '').trim()
    } else if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.includes('卡片主题')) {
      const cols = trimmed
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (cols.length >= 3 && cols[0] && /\d+/.test(cols[0])) {
        const id = normalizeCardId(cols[0])
        const rawTitle = cols[1] ?? ''
        const summary = cols[2] ?? ''
        const isCore = /核心/.test(rawTitle)
        const numMatch = /(\d+)/.exec(id)
        const numPrefix = numMatch?.[1]?.padStart(2, '0')
        const totalCardArchived = opts.archivedFiles.find((f) => f.startsWith('01_全篇脉络总卡'))
        const matchedFile = numPrefix
          ? opts.archivedFiles.find((f) => f.startsWith(`卡${numPrefix}`) || f.startsWith(`卡 ${numPrefix}`))
          : undefined
        const resolvedArchive = matchedFile ?? totalCardArchived
        cards.push({
          id,
          title: rawTitle,
          summary,
          isCore,
          status: resolvedArchive ? 'done' : 'pending',
          ...(resolvedArchive ? { archivedName: resolvedArchive } : {}),
        })
      }
    }
  }

  let currentCardId: string | null = null
  const firstPendingIdx = cards.findIndex((c) => c.status === 'pending')
  if (firstPendingIdx >= 0) {
    const active = cards[firstPendingIdx]!
    currentCardId = active.id
    cards[firstPendingIdx] = { ...active, status: 'active' }
  }

  return {
    key: opts.key,
    source: 'workspace',
    topicTitle,
    material,
    depthMode,
    coreProblem,
    prerequisites,
    toyExampleRange,
    toyExampleValues,
    currentCardId,
    cards,
    svgAssets: opts.svgAssets,
    updatedAt: opts.updatedAt,
  }
}

export class BlueprintStore {
  private readonly sessions = new Map<string, SessionBlueprintState>()
  private readonly sessionCwdMap = new Map<string, string>()
  private readonly customNotesDirs = new Set<string>()

  recordSessionCwd(sessionId: string, cwd: string): void {
    if (sessionId && cwd) {
      this.sessionCwdMap.set(sessionId, cwd)
    }
  }

  getSessionCwd(sessionId: string): string | undefined {
    return this.sessionCwdMap.get(sessionId)
  }

  syncSessionBlueprint(input: SyncBlueprintInput): BlueprintView {
    const existing = this.sessions.get(input.sessionId)
    const svgMap = existing?.svgMap ?? new Map<string, string>()
    const cardMarkdownMap = existing?.cardMarkdownMap ?? new Map<string, { title: string; markdown: string }>()
    const activeId = input.currentCardId ? normalizeCardId(input.currentCardId) : null
    const cleanNotesDir = normalizeNotesDirInput(input.notesDir) ?? existing?.notesDir
    if (cleanNotesDir) {
      this.customNotesDirs.add(cleanNotesDir)
    }

    const cards: BlueprintCardItem[] = input.cards.map((c) => {
      const normId = normalizeCardId(c.id)
      const status: CardStatus =
        c.status ?? (activeId && normId === activeId ? 'active' : 'pending')
      const safeArchived =
        c.archivedName && isSafeSingleSegment(c.archivedName) && c.archivedName.toLowerCase().endsWith('.md')
          ? c.archivedName
          : undefined
      return {
        id: normId,
        title: c.title,
        summary: c.summary,
        isCore: Boolean(c.isCore) || /核心/.test(c.title),
        status,
        ...(c.probeStatus ? { probeStatus: c.probeStatus } : {}),
        ...(c.probeReason ? { probeReason: c.probeReason } : {}),
        ...(safeArchived ? { archivedName: safeArchived } : {}),
      }
    })

    const view: BlueprintView = {
      key: `session:${input.sessionId}`,
      source: 'session',
      topicTitle: input.topicTitle.trim(),
      material: input.material?.trim() ?? '',
      depthMode: input.depthMode.trim() || '标准推演',
      coreProblem: input.coreProblem.trim(),
      prerequisites: input.prerequisites ?? [],
      toyExampleRange: input.toyExampleRange?.trim() ?? '',
      toyExampleValues: input.toyExampleValues?.trim() ?? '',
      currentCardId: activeId,
      cards,
      svgAssets: [...svgMap.keys()],
      updatedAt: new Date().toISOString(),
    }

    if (!this.sessions.has(input.sessionId) && this.sessions.size >= MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value
      if (typeof oldestKey === 'string') this.sessions.delete(oldestKey)
    }
    this.sessions.set(input.sessionId, {
      view,
      ...(cleanNotesDir ? { notesDir: cleanNotesDir } : {}),
      svgMap,
      cardMarkdownMap,
    })
    return view
  }

  recordSessionSvg(sessionId: string, assetName: string, svgContent: string): void {
    if (!sessionId || !isSafeSingleSegment(assetName)) return
    const entry = this.sessions.get(sessionId)
    if (!entry) {
      this.sessions.set(sessionId, {
        view: {
          key: `session:${sessionId}`,
          source: 'session',
          topicTitle: '当前会话伴学配图',
          material: '',
          depthMode: '靶向直答 / 会话伴学',
          coreProblem: '',
          prerequisites: [],
          toyExampleRange: '',
          toyExampleValues: '',
          currentCardId: null,
          cards: [],
          svgAssets: [assetName],
          updatedAt: new Date().toISOString(),
        },
        svgMap: new Map([[assetName, svgContent]]),
        cardMarkdownMap: new Map(),
      })
      return
    }
    entry.svgMap.set(assetName, svgContent)
    entry.view = {
      ...entry.view,
      svgAssets: [...entry.svgMap.keys()],
      updatedAt: new Date().toISOString(),
    }
  }

  private async enrichSessionViewFromDisk(
    view: BlueprintView,
    notesDir: string,
    cwd: string,
  ): Promise<BlueprintView> {
    const safe = resolveSafeRelativeDir(cwd, notesDir)
    if (!safe) return view
    try {
      const dirFiles = await fs.readdir(safe.absDir)
      const archivedFiles = dirFiles.filter(
        (f) => f.endsWith('.md') && f !== '00_伴学脉络蓝图.md' && isSafeSingleSegment(f),
      )
      let diskSvgs: string[] = []
      try {
        const assetFiles = await fs.readdir(path.join(safe.absDir, 'assets'))
        diskSvgs = assetFiles.filter((f) => f.toLowerCase().endsWith('.svg') && isSafeSingleSegment(f))
      } catch {
        diskSvgs = []
      }
      const totalCardArchived = archivedFiles.find((f) => f.startsWith('01_全篇脉络总卡'))
      const cards = view.cards.map((c) => {
        if (c.archivedName) return c
        const numMatch = /(\d+)/.exec(c.id)
        const numPrefix = numMatch?.[1]?.padStart(2, '0')
        const matchedFile = numPrefix
          ? archivedFiles.find((f) => f.startsWith(`卡${numPrefix}`) || f.startsWith(`卡 ${numPrefix}`))
          : undefined
        const resolved = matchedFile ?? (c.status === 'done' ? totalCardArchived : undefined)
        return resolved ? { ...c, archivedName: resolved } : c
      })
      const mergedSvgs = [...new Set([...view.svgAssets, ...diskSvgs])]
      return { ...view, cards, svgAssets: mergedSvgs }
    } catch {
      return view
    }
  }

  async listBlueprints(opts: { sessionId?: string | undefined; cwd?: string | undefined }): Promise<BlueprintView[]> {
    const result: BlueprintView[] = []
    const resolvedCwd = opts.cwd ?? (opts.sessionId ? this.sessionCwdMap.get(opts.sessionId) : undefined)

    if (opts.sessionId) {
      const mem = this.sessions.get(opts.sessionId)
      if (mem) {
        result.push(
          mem.notesDir && resolvedCwd
            ? await this.enrichSessionViewFromDisk(mem.view, mem.notesDir, resolvedCwd)
            : mem.view,
        )
      }
    }

    if (resolvedCwd) {
      const wsViews = await this.scanWorkspaceBlueprints(resolvedCwd)
      result.push(...wsViews)
    }

    return result
  }

  private resolveWorkspaceTopicDir(key: string, cwd: string): string | null {
    if (!key.startsWith('ws:')) return null
    const sub = key.slice(3)
    if (isSafeSingleSegment(sub)) {
      return path.join(cwd, '学习笔记', sub)
    }
    if (!this.customNotesDirs.has(sub)) {
      return null
    }
    return resolveSafeRelativeDir(cwd, sub)?.absDir ?? null
  }

  private async readBlueprintAtDir(topicDir: string, key: string, fallbackTopic: string): Promise<BlueprintView | null> {
    const bpFile = path.join(topicDir, '00_伴学脉络蓝图.md')
    try {
      const [rawBp, stat, dirFiles] = await Promise.all([
        fs.readFile(bpFile, 'utf-8'),
        fs.stat(bpFile),
        fs.readdir(topicDir),
      ])
      const archivedFiles = dirFiles.filter(
        (f) => f.endsWith('.md') && f !== '00_伴学脉络蓝图.md' && isSafeSingleSegment(f),
      )
      let svgAssets: string[] = []
      try {
        const assetFiles = await fs.readdir(path.join(topicDir, 'assets'))
        svgAssets = assetFiles.filter((f) => f.toLowerCase().endsWith('.svg') && isSafeSingleSegment(f))
      } catch {
        svgAssets = []
      }
      return parseBlueprintMarkdown(rawBp, {
        key,
        fallbackTopic,
        archivedFiles,
        svgAssets,
        updatedAt: stat.mtime.toISOString(),
      })
    } catch {
      return null
    }
  }

  private async scanWorkspaceBlueprints(cwd: string): Promise<BlueprintView[]> {
    const views: BlueprintView[] = []
    const scannedDirs = new Set<string>()
    const notesRoot = path.join(cwd, '学习笔记')
    try {
      const entries = await fs.readdir(notesRoot, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || !isSafeSingleSegment(entry.name)) continue
        const topicDir = path.join(notesRoot, entry.name)
        scannedDirs.add(path.resolve(topicDir))
        const view = await this.readBlueprintAtDir(topicDir, `ws:${entry.name}`, entry.name)
        if (view) views.push(view)
      }
    } catch {
      // No ./学习笔记 directory yet
    }
    for (const relDir of this.customNotesDirs) {
      const safe = resolveSafeRelativeDir(cwd, relDir)
      if (!safe) continue
      const absResolved = path.resolve(safe.absDir)
      if (scannedDirs.has(absResolved)) continue
      scannedDirs.add(absResolved)
      const view = await this.readBlueprintAtDir(safe.absDir, `ws:${safe.relPosix}`, path.basename(safe.absDir))
      if (view) views.push(view)
    }
    return views.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async readArchivedCard(opts: {
    key: string
    archivedName: string
    cwd?: string | undefined
    sessionId?: string | undefined
  }): Promise<CardDetailView | null> {
    if (!isSafeSingleSegment(opts.archivedName) || !opts.archivedName.toLowerCase().endsWith('.md')) return null

    const resolvedCwd = opts.cwd ?? (opts.sessionId ? this.sessionCwdMap.get(opts.sessionId) : undefined)
    if (!resolvedCwd) return null

    let topicDir: string | null = null
    if (opts.key.startsWith('session:')) {
      const sid = opts.key.slice('session:'.length)
      const notesDir = this.sessions.get(sid)?.notesDir
      topicDir = notesDir ? resolveSafeRelativeDir(resolvedCwd, notesDir)?.absDir ?? null : null
    } else if (opts.key.startsWith('ws:')) {
      topicDir = this.resolveWorkspaceTopicDir(opts.key, resolvedCwd)
    }
    if (!topicDir) return null

    const cardPath = path.join(topicDir, opts.archivedName)
    try {
      const md = await fs.readFile(cardPath, 'utf-8')
      const h1 = md.split(/\r?\n/).find((l) => l.startsWith('# '))
      const svgRefs = extractSvgRefs(md)
      const inlineSvgs: Record<string, string> = {}
      await Promise.all(
        svgRefs.map(async (svgName) => {
          try {
            inlineSvgs[svgName] = await fs.readFile(path.join(topicDir, 'assets', svgName), 'utf-8')
          } catch {
            // Skip missing SVG on disk; card text remains readable
          }
        }),
      )
      return {
        cardId: opts.archivedName.replace(/\.md$/i, ''),
        title: h1 ? h1.replace(/^#\s*/, '').trim() : opts.archivedName,
        markdown: md,
        svgRefs,
        ...(Object.keys(inlineSvgs).length > 0 ? { inlineSvgs } : {}),
      }
    } catch {
      return null
    }
  }

  async validateSyncedNotes(opts: {
    cwd: string
    notesDir: string
    cards: readonly BlueprintCardItem[]
  }): Promise<string[]> {
    const safe = resolveSafeRelativeDir(opts.cwd, opts.notesDir)
    if (!safe) {
      return [`notesDir "${opts.notesDir}" 不是合法的工作区相对子目录，未执行磁盘校验。`]
    }

    const warnings: string[] = []
    let dirFiles: string[] = []
    try {
      dirFiles = await fs.readdir(safe.absDir)
    } catch {
      return [`目录 ${safe.relPosix} 尚未创建，无法核对蓝图与归档卡片。`]
    }

    const bpPath = path.join(safe.absDir, '00_伴学脉络蓝图.md')
    try {
      const rawBp = await fs.readFile(bpPath, 'utf-8')
      const parsed = parseBlueprintMarkdown(rawBp, {
        key: `ws:${safe.relPosix}`,
        fallbackTopic: path.basename(safe.absDir),
        archivedFiles: [],
        svgAssets: [],
        updatedAt: '',
      })
      if (parsed.cards.length === 0) {
        warnings.push(`${safe.relPosix}/00_伴学脉络蓝图.md 未解析出有效卡片表格行（请检查“| 卡 01 | 主题 | 说明 |”格式）。`)
      }
    } catch {
      warnings.push(`目录 ${safe.relPosix} 尚未写入 00_伴学脉络蓝图.md。`)
    }

    let diskSvgs = new Set<string>()
    try {
      const assetFiles = await fs.readdir(path.join(safe.absDir, 'assets'))
      diskSvgs = new Set(assetFiles.filter((f) => f.toLowerCase().endsWith('.svg') && isSafeSingleSegment(f)))
    } catch {
      diskSvgs = new Set()
    }

    const archivedMdFiles = dirFiles.filter((f) => f.endsWith('.md') && f !== '00_伴学脉络蓝图.md' && isSafeSingleSegment(f))
    const totalCard = archivedMdFiles.find((f) => f.startsWith('01_全篇脉络总卡'))
    const checkedFiles = new Set<string>()

    for (const card of opts.cards) {
      if (card.status !== 'done') continue
      const numMatch = /(\d+)/.exec(card.id)
      const numPrefix = numMatch?.[1]?.padStart(2, '0')
      const matchedFile = card.archivedName
        ? archivedMdFiles.includes(card.archivedName)
          ? card.archivedName
          : undefined
        : (numPrefix
            ? archivedMdFiles.find((f) => f.startsWith(`卡${numPrefix}`) || f.startsWith(`卡 ${numPrefix}`))
            : undefined) ?? totalCard

      if (!matchedFile) {
        warnings.push(`卡片 ${card.id} 已标为 done，但目录 ${safe.relPosix} 下未找到对应归档 .md 文件。`)
        continue
      }
      if (checkedFiles.has(matchedFile)) continue
      checkedFiles.add(matchedFile)

      try {
        const mdText = await fs.readFile(path.join(safe.absDir, matchedFile), 'utf-8')
        const imgRe = /!\[[^\]]*\]\(([^)]+)\)/g
        let imgMatch: RegExpExecArray | null
        while ((imgMatch = imgRe.exec(mdText)) !== null) {
          const rawTarget = (imgMatch[1] ?? '').trim().split(/\s+/)[0] ?? ''
          if (!rawTarget || /^https?:\/\//i.test(rawTarget)) continue
          const normalized = rawTarget.replace(/^\.\//, '')
          if (normalized.startsWith('assets/') && normalized.toLowerCase().endsWith('.svg')) {
            const svgName = normalized.slice('assets/'.length)
            if (!isSafeSingleSegment(svgName) || !diskSvgs.has(svgName)) {
              warnings.push(`${matchedFile} 引用了缺失矢量图 assets/${svgName}。`)
            }
          } else {
            warnings.push(`${matchedFile} 图片路径 "${rawTarget}" 未遵循相对路径 assets/卡XX_图名.svg 约定。`)
          }
        }
      } catch {
        warnings.push(`无法读取已归档卡片 ${matchedFile}。`)
      }
    }

    return warnings
  }

  async readSvgAsset(opts: {
    key: string
    assetName: string
    cwd?: string | undefined
    sessionId?: string | undefined
  }): Promise<string | null> {
    if (!isSafeSingleSegment(opts.assetName) || !opts.assetName.toLowerCase().endsWith('.svg')) {
      return null
    }
    const resolvedCwd = opts.cwd ?? (opts.sessionId ? this.sessionCwdMap.get(opts.sessionId) : undefined)
    if (opts.key.startsWith('session:')) {
      const sid = opts.key.slice('session:'.length)
      const entry = this.sessions.get(sid)
      const memSvg = entry?.svgMap.get(opts.assetName)
      if (memSvg) return memSvg
      if (entry?.notesDir && resolvedCwd) {
        const safe = resolveSafeRelativeDir(resolvedCwd, entry.notesDir)
        if (safe) {
          try {
            return await fs.readFile(path.join(safe.absDir, 'assets', opts.assetName), 'utf-8')
          } catch {
            return null
          }
        }
      }
      return null
    }
    if (opts.key.startsWith('ws:')) {
      if (!resolvedCwd) return null
      const topicDir = this.resolveWorkspaceTopicDir(opts.key, resolvedCwd)
      if (!topicDir) return null
      const svgPath = path.join(topicDir, 'assets', opts.assetName)
      try {
        return await fs.readFile(svgPath, 'utf-8')
      } catch {
        return null
      }
    }
    return null
  }
}
