import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BlueprintCardItem, BlueprintView, CardDetailView } from '../contract.js'
import { fetchArchivedCard, fetchStudyOverview, fetchSvgPreview } from './api.js'
import { sanitizeSvgForPreview } from './sanitize-svg.js'
import { useCurrentSessionId } from './use-session.js'

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

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStudyOverview(sessionId)
      setBlueprints(res.blueprints)
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

      {error ? (
        <div className="dsh-study-section" style={{ borderColor: '#dc2626', color: '#dc2626' }}>
          读取失败：{error}
        </div>
      ) : null}

      {!activeBlueprint ? (
        <div className="dsh-study-empty">
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>暂无进行中的伴学脉络</div>
          <div>
            在对话框输入 <code>/study</code> 并附上公式截图、论文段落或源码，选定深度档位后，此处将自动同步卡片路线、统一小算例与矢量配图预览。
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
                    {card.archivedName ? (
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          className="dsh-study-btn"
                          onClick={() => void handleOpenCard(card.archivedName!)}
                        >
                          {cardDetail?.cardId === card.archivedName.replace(/\.md$/i, '')
                            ? '收起笔记卡'
                            : `查看 ${card.archivedName}`}
                        </button>
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
              <pre className="dsh-study-md-preview">{cardDetail.markdown}</pre>
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
