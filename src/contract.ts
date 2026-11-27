export const REFERENCE_TOPICS = [
  'continuous-operator',
  'spatial-geometry',
  'transform-phasor',
  'tensor-array',
  'probability-stochastic',
  'conservation-network',
  'discrete-state',
  'proof-logic',
  'optimization-variational',
  'numerical-precision',
] as const

export type ReferenceTopic = (typeof REFERENCE_TOPICS)[number]

export const WORKFLOW_TOPICS = ['long-corpus', 'probing', 'plotting', 'archiving', 'teaching-style'] as const

export type WorkflowTopic = (typeof WORKFLOW_TOPICS)[number]

export type CardStatus = 'pending' | 'active' | 'done'
export type ProbeStatus = 'pending' | 'probed' | 'skipped'

export interface BlueprintCardItem {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly isCore: boolean
  readonly status: CardStatus
  readonly probeStatus?: ProbeStatus | undefined
  readonly probeReason?: string | undefined
  readonly archivedName?: string
}

export interface BlueprintView {
  readonly key: string
  readonly source: 'session' | 'workspace'
  readonly topicTitle: string
  readonly material: string
  readonly depthMode: string
  readonly coreProblem: string
  readonly prerequisites: readonly string[]
  readonly toyExampleRange: string
  readonly toyExampleValues: string
  readonly currentCardId: string | null
  readonly cards: readonly BlueprintCardItem[]
  readonly svgAssets: readonly string[]
  readonly updatedAt: string
}

export interface CardDetailView {
  readonly cardId: string
  readonly title: string
  readonly markdown: string
  readonly svgRefs: readonly string[]
  readonly inlineSvgs?: Readonly<Record<string, string>> | undefined
  readonly inlineImages?: Readonly<Record<string, string>> | undefined
}

export interface UpdateInfo {
  readonly currentVersion: string
  readonly latestVersion: string | null
  readonly updateAvailable: boolean
  readonly releaseUrl: string
  readonly checkedAt: string | null
}

export interface OverviewResponse {
  readonly ok: true
  readonly sessionId: string | null
  readonly blueprints: readonly BlueprintView[]
  readonly update?: UpdateInfo | undefined
}

export interface CardDetailResponse {
  readonly ok: true
  readonly detail: CardDetailView
}

export interface SvgPreviewResponse {
  readonly ok: true
  readonly name: string
  readonly svg: string
}

export const API_PREFIX = '/study-plugin/api'
