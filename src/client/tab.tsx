import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BlueprintCardItem, BlueprintView, CardDetailView, UpdateInfo } from '../contract.js'
import { fetchArchivedCard, fetchStudyOverview, fetchSvgPreview } from './api.js'
import { CardPreview } from './card-preview.js'
import { sanitizeSvgForPreview } from './sanitize-svg.js'
import { useCurrentSessionId } from './use-session.js'

const UPDATE_SNOOZE_KEY = 'dsh-plugin-study:update-snooze-until'
const UPDATE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

function readSnoozeUntil(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0
    const raw = window.localStorage.getItem(UPDATE_SNOOZE_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function writeSnoozeUntil(ts: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(UPDATE_SNOOZE_KEY, String(ts))
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export interface StudyBlueprintTabProps {
  readonly uiSession: unknown
  readonly onOpenChat?: (() => void) | undefined
}

function statusLabel(status: BlueprintCardItem['status']): { text: string; cls: string } {
  if (status === 'done') return { text: '已归档', cls: 'dsh-study-status-done' }
  if (status === 'active') return { text: '推演中', cls: 'dsh-study-status-active' }
  return { text: '待学', cls: 'dsh-study-status-pending' }
}

function probeLabel(probeStatus: BlueprintCardItem['probeStatus']): string | null {
  if (probeStatus === 'probed') return '已摸底'
  if (probeStatus === 'skipped') return '免摸底直进'
  if (probeStatus === 'pending') return '待探测'
  return null
}

export function StudyBlueprintTabTitle(): ReactNode {
  return <span>伴学脉络</span>
}

export function StudyBlueprintTab(props: StudyBlueprintTabProps): ReactNode {
  const sessionId = useCurrentSessionId(props.uiSession)
  const [blueprints, setBlueprints] = useState<readonly BlueprintView[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [cardDetail, setCardDetail] = useState<CardDetailView | null>(null)
  const [previewSvg, setPreviewSvg] = useState<{ name: string; html: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => readSnoozeUntil())

  const handleCopyPrompt = async (key: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev))
      }, 1500)
    } catch {
      setError(`复制“${text}”失败，请手动输入。`)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStudyOverview(sessionId)
      setBlueprints(res.blueprints)
      setUpdateInfo(res.update ?? null)
      setSelectedKey((prev) => {
        if (prev && res.blueprints.some((b) => b.key === prev)) return prev
        return res.blueprints[0]?.key ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 6000)
    return () => clearInterval(timer)
  }, [refresh])

  const activeBlueprint = useMemo(
    () => blueprints.find((b) => b.key === selectedKey) ?? blueprints[0] ?? null,
    [blueprints, selectedKey],
  )

  const handleOpenCard = async (archivedName: string) => {
    if (!activeBlueprint) return
    if (cardDetail?.cardId === archivedName.replace(/\.md$/i, '')) {
      setCardDetail(null)
      return
    }
    try {
      const res = await fetchArchivedCard({
        key: activeBlueprint.key,
        name: archivedName,
        sessionId,
      })
      setCardDetail(res.detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handlePreviewSvg = async (assetName: string) => {
    if (!activeBlueprint) return
    if (previewSvg?.name === assetName) {
      setPreviewSvg(null)
      return
    }
    try {
      const res = await fetchSvgPreview({
        key: activeBlueprint.key,
        name: assetName,
        sessionId,
      })
      const safeHtml = sanitizeSvgForPreview(res.svg)
      if (safeHtml) {
        setPreviewSvg({ name: assetName, html: safeHtml })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const doneCount = activeBlueprint?.cards.filter((c) => c.status === 'done').length ?? 0
  const totalCount = activeBlueprint?.cards.length ?? 0
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const showUpdateBanner = Boolean(
    updateInfo?.updateAvailable && updateInfo.latestVersion && Date.now() >= snoozedUntil,
  )

  return (
    <div className="dsh-study-root">
      <div className="dsh-study-toolbar">
        {blueprints.length > 1 ? (
          <select
            className="dsh-study-select"
            value={activeBlueprint?.key ?? ''}
            onChange={(e) => {
              setSelectedKey(e.target.value)
              setCardDetail(null)
              setPreviewSvg(null)
            }}
          >
            {blueprints.map((b) => (
              <option key={b.key} value={b.key}>
                {b.topicTitle} ({b.source === 'session' ? '会话' : '工作区'})
              </option>
            ))}
          </select>
        ) : (
          <strong style={{ fontSize: '13.5px' }}>
            {activeBlueprint ? activeBlueprint.topicTitle : '伴学脉络抽屉'}
          </strong>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="dsh-study-btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? '同步中' : '刷新'}
          </button>
          {props.onOpenChat ? (
            <button type="button" className="dsh-study-btn" onClick={props.onOpenChat}>
              回对话
            </button>
          ) : null}
        </div>
      </div>

      {showUpdateBanner && updateInfo?.latestVersion ? (
        <div className="dsh-study-update-banner" role="status">
          <div className="dsh-study-update-banner-head">
            <span>
              有新版 v{updateInfo.latestVersion}（当前 v{updateInfo.currentVersion}）
            </span>
          </div>
          <div className="dsh-study-update-banner-sub">
            请在 DSH 插件页更新，或通过市场源 / npm 升级。
          </div>
          <div className="dsh-study-update-banner-actions">
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="dsh-study-btn dsh-study-btn-primary dsh-study-link-btn"
            >
              查看更新说明
            </a>
            <button
              type="button"
              className="dsh-study-btn"
              onClick={() => {
                const until = Date.now() + UPDATE_SNOOZE_MS
                writeSnoozeUntil(until)
                setSnoozedUntil(until)
              }}
            >
              7 天内不提醒
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="dsh-study-section" style={{ borderColor: '#dc2626', color: '#dc2626' }}>
          读取失败：{error}
        </div>
      ) : null}

      {!activeBlueprint ? (
        <div className="dsh-study-empty">
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>暂无进行中的伴学脉络</div>
          <div>
            在对话框输入 <code>/study</code> 并附上公式截图、论文段落或源码，选定深度档位后，此处将自动同步卡片路线、已学主线进度与矢量配图预览。
          </div>
        </div>
      ) : (
        <>
          <div className="dsh-study-meta-row">
            <span className="dsh-study-badge">{activeBlueprint.depthMode}</span>
            <span className="dsh-study-badge dsh-study-badge-muted">
              {activeBlueprint.source === 'session' ? '会话内伴读' : '工作区笔记'}
            </span>
            {totalCount > 0 ? (
              <span className="dsh-study-badge dsh-study-badge-muted">
                进度 {doneCount}/{totalCount}
              </span>
            ) : null}
          </div>

          {totalCount > 0 ? (
            <div className="dsh-study-progress-track" aria-label="伴学进度">
              <div className="dsh-study-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          ) : null}

          {activeBlueprint.coreProblem || activeBlueprint.material ? (
            <div className="dsh-study-section">
              <div className="dsh-study-section-title">核心问题与材料</div>
              {activeBlueprint.material ? (
                <div className="dsh-study-kv">
                  <strong>材料：</strong>
                  {activeBlueprint.material}
                </div>
              ) : null}
              {activeBlueprint.coreProblem ? (
                <div className="dsh-study-kv">{activeBlueprint.coreProblem}</div>
              ) : null}
            </div>
          ) : null}

          {activeBlueprint.toyExampleRange || activeBlueprint.toyExampleValues ? (
            <div className="dsh-study-section">
              <div className="dsh-study-section-title">贯穿底座算例</div>
              {activeBlueprint.toyExampleRange ? (
                <div className="dsh-study-kv">
                  <strong>输入设定：</strong>
                  {activeBlueprint.toyExampleRange}
                </div>
              ) : null}
              {activeBlueprint.toyExampleValues ? (
                <div className="dsh-study-kv">
                  <strong>固定数值：</strong>
                  {activeBlueprint.toyExampleValues}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeBlueprint.cards.length > 0 ? (
            <div className="dsh-study-card-list">
              {activeBlueprint.cards.map((card) => {
                const st = statusLabel(card.status)
                const probeTxt = probeLabel(card.probeStatus)
                const cardCls =
                  card.status === 'active'
                    ? 'dsh-study-card dsh-study-card-active'
                    : card.status === 'done'
                      ? 'dsh-study-card dsh-study-card-done'
                      : 'dsh-study-card'
                return (
                  <div key={card.id} className={cardCls}>
                    <div className="dsh-study-card-head">
                      <span>
                        {card.id}｜{card.title}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {card.isCore ? (
                          <span className="dsh-study-badge dsh-study-badge-core">核心</span>
                        ) : null}
                        {probeTxt ? (
                          <span className="dsh-study-badge dsh-study-badge-muted">{probeTxt}</span>
                        ) : null}
                        <span className={st.cls}>{st.text}</span>
                      </div>
                    </div>
                    <div className="dsh-study-card-summary">{card.summary}</div>
                    {card.probeReason ? (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', opacity: 0.72 }}>
                        前置判断：{card.probeReason}
                      </div>
                    ) : null}
                    {card.status === 'active' || card.archivedName ? (
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {card.status === 'active' && activeBlueprint.depthMode !== '直觉速通' ? (
                          <button
                            type="button"
                            className="dsh-study-btn dsh-study-btn-primary"
                            onClick={() => void handleCopyPrompt(`${card.id}:archive`, '落盘')}
                          >
                            {copiedKey === `${card.id}:archive` ? '已复制「落盘」' : '复制「落盘」'}
                          </button>
                        ) : null}
                        {card.status === 'active' ? (
                          <button
                            type="button"
                            className="dsh-study-btn"
                            onClick={() => void handleCopyPrompt(`${card.id}:next`, '继续')}
                          >
                            {copiedKey === `${card.id}:next` ? '已复制「继续」' : '复制「继续」'}
                          </button>
                        ) : null}
                        {card.archivedName ? (
                          <button
                            type="button"
                            className="dsh-study-btn"
                            onClick={() => void handleOpenCard(card.archivedName!)}
                          >
                            {cardDetail?.cardId === card.archivedName.replace(/\.md$/i, '')
                              ? '收起笔记卡'
                              : `查看 ${card.archivedName}`}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {cardDetail ? (
            <div className="dsh-study-section">
              <div className="dsh-study-section-title">
                <span>{cardDetail.title}</span>
                <button
                  type="button"
                  className="dsh-study-btn"
                  onClick={() => setCardDetail(null)}
                >
                  关闭
                </button>
              </div>
              <CardPreview detail={cardDetail} />
            </div>
          ) : null}

          {activeBlueprint.svgAssets.length > 0 ? (
            <div className="dsh-study-section">
              <div className="dsh-study-section-title">矢量配图清单</div>
              <div className="dsh-study-chip-row">
                {activeBlueprint.svgAssets.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="dsh-study-btn"
                    onClick={() => void handlePreviewSvg(name)}
                  >
                    {previewSvg?.name === name ? `收起 ${name}` : name}
                  </button>
                ))}
              </div>
              {previewSvg ? (
                <div
                  className="dsh-study-svg-box"
                  dangerouslySetInnerHTML={{ __html: previewSvg.html }}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
