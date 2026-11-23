import * as fsSync from 'node:fs'
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

const IMAGE_MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}
const SUPPORTED_IMAGE_EXTS = new Set(['.svg', ...Object.keys(IMAGE_MIME_MAP)])
const FENCED_CODE_RE = /(?:```[\s\S]*?```|~~~[\s\S]*?~~~)/g
const INLINE_CODE_RE = /`[^`\n]*`/g
const FENCE_OPEN_RE = /^[ ]{0,3}(`{3,}|~{3,})/
const LIST_MARKER_RE = /^([ ]*)((?:[-*+]|\d{1,9}[.)])[ ]+)/
const INLINE_OR_DISPLAY_MATH_RE = /(?<!\\)\$\$|(?<!\\)\$[^$\n]+(?<!\\)\$/
const UNESCAPED_DOUBLE_DOLLAR_RE = /(?<!\\)\$\$/
const FIRST_H1_RE = /^\s*#\s+[^\n]*\n?/
const COLOR_CODE_RE = /(?:\\textcolor\b|\\color\s*\{|<span\b[^>]*\bcolor\s*:)/i
const SOURCE_REF_RE = new RegExp(
  '(?:' +
    '(?<![形模方通算列简格款])式\\s*(?:[(（]\\s*\\d+(?:[.\\-]\\d+)*\\s*[)）]|\\d+(?:[.\\-]\\d+)+)' +
    '|(?<![A-Za-z0-9_])(?:Eqs?\\.?)\\s*(?:[(（]\\s*\\d+(?:[.\\-]\\d+)*\\s*[)）]|\\d+(?:[.\\-]\\d+)*)(?![A-Za-z0-9_])' +
    '|(?:详见|参见|见|参考|参照)\\s*(?:原书|原文|原件|教材|上文|前文|后文)?\\s*(?:第\\s*\\d+(?:\\.\\d+)*\\s*[章节页行]|\\d+(?:\\.\\d+)+\\s*[章节]|附录|补充推导)' +
    '|(?:原书|原文|原件)\\s*(?:第\\s*\\d+(?:\\.\\d+)*\\s*[章节页]|\\d+(?:\\.\\d+)+\\s*[章节]|附录|补充推导)' +
    '|(?<![A-Za-z0-9_])(?:Section|Sec\\.|Appendix|App\\.)\\s*(?:\\d+(?:\\.\\d+)*|[A-Z](?:\\.\\d+)?)(?![A-Za-z0-9_])' +
    '|(?:由|据|按|根据|见)\\s*(?:原书|原文|原件)?\\s*(?:引理|定理|推论|命题)\\s*\\d+(?:[.\\-]\\d+)*' +
    ')',
  'gi',
)

const CARD_ID_BODY_SRC =
  '[0-9]+(?:\\.[1-9][0-9]*)?_0(?:\\.[1-9][0-9]*)?|[0-9]+(?:\\.0(?:[A-Za-z]|\\.[0-9]+)?|\\.[1-9][0-9]*)?'
const PLAN_CARD_RE = new RegExp(`(?:^|卡\\s*)(${CARD_ID_BODY_SRC})(?![\\d.A-Za-z_])`)
const CARD_FILE_RE = new RegExp(`^卡\\s*(${CARD_ID_BODY_SRC})(?:[_\\-\\s]|$)`)
const PREREQ_NEW_RE = /^(\d+)(?:\.([1-9]\d*))?_0\.([1-9]\d*)$/
const PREREQ_OLD_UNDER_RE = /^(\d+)(?:\.([1-9]\d*))?_0$/
const PREREQ_OLD_DOT_RE = /^(\d+)\.0(?:([A-Za-z])|\.(\d+))?$/
const MAIN_CARD_RE = /^(\d+)(?:\.([1-9]\d*))?$/

function isSupportedImageFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase()
  return SUPPORTED_IMAGE_EXTS.has(ext)
}

export function extractSvgRefs(markdown: string): string[] {
  const svgRefs: string[] = []
  const re = /!\[[^\]]*\]\((?:assets\/|\.\/assets\/)([a-zA-Z0-9_\u4e00-\u9fa5.-]+\.svg)\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    if (m[1] && isSafeSingleSegment(m[1]) && !svgRefs.includes(m[1])) {
      svgRefs.push(m[1])
    }
  }
  return svgRefs
}

export function extractBitmapImageRefs(markdown: string): string[] {
  const imgRefs: string[] = []
  const re = /!\[[^\]]*\]\((?:assets\/|\.\/assets\/)([a-zA-Z0-9_\u4e00-\u9fa5.-]+\.(?:png|jpe?g|webp))\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    if (m[1] && isSafeSingleSegment(m[1]) && !imgRefs.includes(m[1])) {
      imgRefs.push(m[1])
    }
  }
  return imgRefs
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

function normalizeCardToken(rawToken: string): string {
  const trimmed = rawToken.trim()
  let m = PREREQ_NEW_RE.exec(trimmed)
  if (m?.[1] && m[3]) {
    const base = m[2] ? `${m[1].padStart(2, '0')}.${Number(m[2])}` : m[1].padStart(2, '0')
    return `${base}_0.${Number(m[3])}`
  }
  m = PREREQ_OLD_UNDER_RE.exec(trimmed)
  if (m?.[1]) {
    const base = m[2] ? `${m[1].padStart(2, '0')}.${Number(m[2])}` : m[1].padStart(2, '0')
    return `${base}_0`
  }
  m = PREREQ_OLD_DOT_RE.exec(trimmed)
  if (m?.[1]) {
    const base = m[1].padStart(2, '0')
    if (m[2]) return `${base}.0${m[2].toLowerCase()}`
    if (m[3] !== undefined) return `${base}.0.${Number(m[3])}`
    return `${base}.0`
  }
  m = MAIN_CARD_RE.exec(trimmed)
  if (m?.[1]) {
    return m[2] ? `${m[1].padStart(2, '0')}.${Number(m[2])}` : m[1].padStart(2, '0')
  }
  return trimmed
}

function normalizeCardId(raw: string): string {
  const cleaned = raw.trim().replace(/^卡\s*/, '')
  const m = PLAN_CARD_RE.exec(cleaned)
  if (!m?.[1]) return raw.trim()
  return `卡 ${normalizeCardToken(m[1])}`
}

function extractCardTokenFromId(cardId: string): string | null {
  const cleaned = cardId.trim().replace(/^卡\s*/, '')
  const m = PLAN_CARD_RE.exec(cleaned)
  return m?.[1] ? normalizeCardToken(m[1]) : null
}

function extractCardTokenFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.md$/i, '')
  const m = CARD_FILE_RE.exec(stem)
  return m?.[1] ? normalizeCardToken(m[1]) : null
}

function findArchivedFileForCard(cardId: string, archivedFiles: readonly string[]): string | undefined {
  const targetToken = extractCardTokenFromId(cardId)
  if (!targetToken) return undefined
  return archivedFiles.find((f) => extractCardTokenFromFileName(f) === targetToken)
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(FENCED_CODE_RE, '').replace(INLINE_CODE_RE, '')
}

function expandTabs(line: string, tabSize = 4): string {
  if (!line.includes('\t')) return line
  let out = ''
  let col = 0
  for (const ch of line) {
    if (ch === '\t') {
      const spaces = tabSize - (col % tabSize)
      out += ' '.repeat(spaces)
      col += spaces
    } else {
      out += ch
      col += 1
    }
  }
  return out
}

function isClosingFence(stripped: string, fenceChar: string, fenceLen: number): boolean {
  if (stripped.length < fenceLen) return false
  for (const ch of stripped) {
    if (ch !== fenceChar) return false
  }
  return true
}

export function findIndentedMathLines(markdown: string): Array<{ line: number; indent: number }> {
  const hits: Array<{ line: number; indent: number }> = []
  let fenceChar: string | null = null
  let fenceLen = 0
  let fenceContainer = 0
  let inMath = false
  const listIndents: number[] = []
  let canStartIndentedCode = true

  const lines = markdown.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const lineno = i + 1
    const expanded = expandTabs(lines[i] ?? '')
    const stripped = expanded.trim()
    const indent = expanded.length - expanded.replace(/^ +/, '').length

    if (fenceChar !== null) {
      if (indent <= fenceContainer + 3 && isClosingFence(stripped, fenceChar, fenceLen)) {
        fenceChar = null
        fenceLen = 0
        fenceContainer = 0
        canStartIndentedCode = true
      }
      continue
    }

    if (inMath) {
      if (UNESCAPED_DOUBLE_DOLLAR_RE.test(stripped)) {
        inMath = false
        canStartIndentedCode = true
      }
      continue
    }

    if (!stripped) {
      canStartIndentedCode = true
      continue
    }

    while (listIndents.length > 0) {
      const top = listIndents[listIndents.length - 1]
      if (top !== undefined && indent < top) {
        listIndents.pop()
      } else {
        break
      }
    }
    const activeIndent = listIndents[listIndents.length - 1] ?? 0

    if (canStartIndentedCode && indent >= activeIndent + 4) {
      if (INLINE_OR_DISPLAY_MATH_RE.test(stripped)) {
        hits.push({ line: lineno, indent })
      }
      canStartIndentedCode = true
      continue
    }

    const rel = expanded.slice(activeIndent)
    const mFence = FENCE_OPEN_RE.exec(rel)
    if (mFence?.[1]) {
      const marker = mFence[1]
      const restFence = rel.slice(mFence[0].length)
      const markerChar = marker[0]
      if (markerChar && (markerChar === '~' || !restFence.includes('`'))) {
        fenceChar = markerChar
        fenceLen = marker.length
        fenceContainer = activeIndent
        continue
      }
    }

    if (stripped.startsWith('$$')) {
      const restMath = stripped.slice(2)
      if (UNESCAPED_DOUBLE_DOLLAR_RE.test(restMath)) {
        inMath = false
        canStartIndentedCode = true
      } else {
        inMath = true
      }
      continue
    }

    const mList = LIST_MARKER_RE.exec(expanded)
    if (mList?.[1] !== undefined && mList[2] !== undefined) {
      const markerEnd = mList[1].length + mList[2].length
      const top = listIndents[listIndents.length - 1]
      if (top === undefined || markerEnd > top) {
        listIndents.push(markerEnd)
      } else {
        listIndents[listIndents.length - 1] = markerEnd
      }
      canStartIndentedCode = false
      continue
    }

    if (
      stripped === '>' ||
      stripped.startsWith('#') ||
      stripped.startsWith('---') ||
      stripped.startsWith('***') ||
      stripped.startsWith('___') ||
      stripped.startsWith('|')
    ) {
      canStartIndentedCode = true
    } else {
      canStartIndentedCode = false
    }
  }

  return hits
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
    } else if (/^-\s*\*\*(?:固定)?代入的具体数值\*\*[：:]/.test(trimmed)) {
      toyExampleValues = trimmed.replace(/^-\s*\*\*(?:固定)?代入的具体数值\*\*[：:]\s*/, '').trim()
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
        const totalCardArchived = opts.archivedFiles.find((f) => f.startsWith('01_全篇脉络总卡'))
        const matchedFile = findArchivedFileForCard(id, opts.archivedFiles)
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
        const matchedFile = findArchivedFileForCard(c.id, archivedFiles)
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
      const studyDir = path.join(cwd, '学习伴学', sub)
      if (fsSync.existsSync(path.join(studyDir, '00_伴学脉络蓝图.md'))) {
        return studyDir
      }
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
    for (const rootName of ['学习伴学', '学习笔记']) {
      const notesRoot = path.join(cwd, rootName)
      try {
        const entries = await fs.readdir(notesRoot, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory() || !isSafeSingleSegment(entry.name)) continue
          const topicDir = path.join(notesRoot, entry.name)
          const absResolved = path.resolve(topicDir)
          if (scannedDirs.has(absResolved)) continue
          scannedDirs.add(absResolved)
          const view = await this.readBlueprintAtDir(topicDir, `ws:${entry.name}`, entry.name)
          if (view) views.push(view)
        }
      } catch {
        // Directory does not exist yet
      }
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
      const bitmapRefs = extractBitmapImageRefs(md)
      const inlineSvgs: Record<string, string> = {}
      const inlineImages: Record<string, string> = {}
      await Promise.all([
        ...svgRefs.map(async (svgName) => {
          try {
            inlineSvgs[svgName] = await fs.readFile(path.join(topicDir, 'assets', svgName), 'utf-8')
          } catch {
            // Skip missing SVG on disk; card text remains readable
          }
        }),
        ...bitmapRefs.map(async (imgName) => {
          const mime = IMAGE_MIME_MAP[path.extname(imgName).toLowerCase()]
          if (!mime) return
          try {
            const buf = await fs.readFile(path.join(topicDir, 'assets', imgName))
            inlineImages[imgName] = `data:${mime};base64,${buf.toString('base64')}`
          } catch {
            // Skip missing image on disk; card text remains readable
          }
        }),
      ])
      return {
        cardId: opts.archivedName.replace(/\.md$/i, ''),
        title: h1 ? h1.replace(/^#\s*/, '').trim() : opts.archivedName,
        markdown: md,
        svgRefs,
        ...(Object.keys(inlineSvgs).length > 0 ? { inlineSvgs } : {}),
        ...(Object.keys(inlineImages).length > 0 ? { inlineImages } : {}),
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

    let diskAssets = new Set<string>()
    try {
      const assetFiles = await fs.readdir(path.join(safe.absDir, 'assets'))
      diskAssets = new Set(assetFiles.filter((f) => isSupportedImageFile(f) && isSafeSingleSegment(f)))
    } catch {
      diskAssets = new Set()
    }

    const archivedMdFiles = dirFiles.filter((f) => f.endsWith('.md') && f !== '00_伴学脉络蓝图.md' && isSafeSingleSegment(f))
    const totalCard = archivedMdFiles.find((f) => f.startsWith('01_全篇脉络总卡'))
    const checkedFiles = new Set<string>()

    for (const card of opts.cards) {
      if (card.status !== 'done') continue
      const matchedFile = card.archivedName
        ? archivedMdFiles.includes(card.archivedName)
          ? card.archivedName
          : undefined
        : findArchivedFileForCard(card.id, archivedMdFiles) ?? totalCard

      if (!matchedFile) {
        warnings.push(`卡片 ${card.id} 已标为 done，但目录 ${safe.relPosix} 下未找到对应归档 .md 文件。`)
        continue
      }
      if (checkedFiles.has(matchedFile)) continue
      checkedFiles.add(matchedFile)

      try {
        const mdText = await fs.readFile(path.join(safe.absDir, matchedFile), 'utf-8')
        const prose = stripCodeBlocks(mdText)
        const imgRe = /!\[[^\]]*\]\(([^)]+)\)/g
        let imgMatch: RegExpExecArray | null
        while ((imgMatch = imgRe.exec(prose)) !== null) {
          const rawTarget = (imgMatch[1] ?? '').trim().split(/\s+/)[0] ?? ''
          if (!rawTarget || /^https?:\/\//i.test(rawTarget)) continue
          const normalized = rawTarget.replace(/^\.\//, '')
          if (normalized.startsWith('assets/') && isSupportedImageFile(normalized)) {
            const imgName = normalized.slice('assets/'.length)
            if (!isSafeSingleSegment(imgName) || !diskAssets.has(imgName)) {
              warnings.push(`${matchedFile} 引用了缺失配图 assets/${imgName}。`)
            }
          } else {
            warnings.push(`${matchedFile} 图片路径 "${rawTarget}" 未遵循相对路径 assets/卡XX_图名.<后缀> 约定。`)
          }
        }
        if (COLOR_CODE_RE.test(prose)) {
          warnings.push(`${matchedFile} 正文含禁用公式或文字染色代码。`)
        }
        if (prose.includes('！')) {
          warnings.push(`${matchedFile} 正文含禁用全角感叹号。`)
        }
        const indentedMath = findIndentedMathLines(mdText)
        if (indentedMath.length > 0) {
          const sample = indentedMath
            .slice(0, 3)
            .map((h) => `第 ${h.line} 行(${h.indent} 空格)`)
            .join('、')
          const more = indentedMath.length > 3 ? ` 等 ${indentedMath.length} 处` : ''
          warnings.push(
            `${matchedFile} 存在会被 Markdown 误判为缩进代码块的含公式缩进行（${sample}${more}），请将重载步骤改用 ### 三级小标题并令公式及说明段顶格。`,
          )
        }
        const bodyProse = stripCodeBlocks(mdText.replace(FIRST_H1_RE, ''))
        const refHits = [...new Set([...bodyProse.matchAll(SOURCE_REF_RE)].map((m) => m[0].trim()))]
        if (refHits.length > 0) {
          const sample = refHits.slice(0, 3).join('、')
          const more = refHits.length > 3 ? ` 等 ${refHits.length} 处` : ''
          warnings.push(`${matchedFile} 正文疑似夹带原件式号或章节索引（${sample}${more}），建议改为直接写出算式或内容说明。`)
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
