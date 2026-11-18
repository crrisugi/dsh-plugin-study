import type { ReactNode } from 'react'
import type { CardDetailView } from '../contract.js'
import { sanitizeSvgForPreview } from './sanitize-svg.js'

const IMG_LINE_RE = /^!\[([^\]]*)\]\((?:assets\/|\.\/assets\/)([a-zA-Z0-9_\u4e00-\u9fa5.-]+\.svg)\)\s*$/

function renderInlineSegments(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  let keyIdx = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={`b-${keyIdx++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={`c-${keyIdx++}`} className="dsh-study-inline-code">
          {token.slice(1, -1)}
        </code>,
      )
    }
    lastIdx = match.index + token.length
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }
  return parts
}

export function CardPreview(props: { readonly detail: CardDetailView }): ReactNode {
  const { detail } = props
  const lines = detail.markdown.split(/\r?\n/)
  const blocks: ReactNode[] = []
  const renderedSvgs = new Set<string>()

  let inFence = false
  let fenceLines: string[] = []
  let keyIdx = 0

  const flushFence = () => {
    if (fenceLines.length === 0) return
    blocks.push(
      <pre key={`code-${keyIdx++}`} className="dsh-study-code-block">
        <code>{fenceLines.join('\n')}</code>
      </pre>,
    )
    fenceLines = []
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (trimmed.startsWith('```')) {
      if (inFence) {
        flushFence()
        inFence = false
      } else {
        inFence = true
      }
      continue
    }
    if (inFence) {
      fenceLines.push(rawLine)
      continue
    }
    if (!trimmed) continue

    const imgMatch = IMG_LINE_RE.exec(trimmed)
    if (imgMatch?.[2]) {
      const caption = imgMatch[1]?.trim() || imgMatch[2]
      const svgName = imgMatch[2]
      const rawSvg = detail.inlineSvgs?.[svgName]
      const safeHtml = rawSvg ? sanitizeSvgForPreview(rawSvg) : ''
      if (safeHtml) {
        renderedSvgs.add(svgName)
        blocks.push(
          <figure key={`fig-${keyIdx++}`} className="dsh-study-inline-figure">
            <div className="dsh-study-svg-box" dangerouslySetInnerHTML={{ __html: safeHtml }} />
            <figcaption className="dsh-study-figcaption">{caption}</figcaption>
          </figure>,
        )
      } else {
        blocks.push(
          <div key={`fig-miss-${keyIdx++}`} className="dsh-study-md-muted">
            [配图：{caption}（{svgName}）]
          </div>,
        )
      }
      continue
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <div key={`h3-${keyIdx++}`} className="dsh-study-md-h3">
          {renderInlineSegments(trimmed.slice(4))}
        </div>,
      )
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <div key={`h2-${keyIdx++}`} className="dsh-study-md-h2">
          {renderInlineSegments(trimmed.slice(3))}
        </div>,
      )
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <div key={`h1-${keyIdx++}`} className="dsh-study-md-h1">
          {renderInlineSegments(trimmed.slice(2))}
        </div>,
      )
    } else if (/^[-*]\s+/.test(trimmed)) {
      blocks.push(
        <div key={`li-${keyIdx++}`} className="dsh-study-md-li">
          <span className="dsh-study-md-bullet">•</span>
          <span>{renderInlineSegments(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>,
      )
    } else {
      blocks.push(
        <p key={`p-${keyIdx++}`} className="dsh-study-md-p">
          {renderInlineSegments(trimmed)}
        </p>,
      )
    }
  }
  if (inFence) flushFence()

  for (const svgName of detail.svgRefs) {
    if (renderedSvgs.has(svgName)) continue
    const rawSvg = detail.inlineSvgs?.[svgName]
    const safeHtml = rawSvg ? sanitizeSvgForPreview(rawSvg) : ''
    if (safeHtml) {
      blocks.push(
        <figure key={`extra-fig-${keyIdx++}`} className="dsh-study-inline-figure">
          <div className="dsh-study-svg-box" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          <figcaption className="dsh-study-figcaption">{svgName}</figcaption>
        </figure>,
      )
    }
  }

  return <div className="dsh-study-md-preview">{blocks}</div>
}
