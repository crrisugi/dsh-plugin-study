const STYLE_ATTR = 'data-dsh-plugin-study-styles'

const CSS_TEXT = `
.dsh-study-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 20px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  font-size: 13px;
  line-height: 1.55;
  color: var(--dsh-fg, #1e293b);
}
.dsh-study-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-study-select {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsh-border, rgba(148, 163, 184, 0.35));
  background: var(--dsh-surface, rgba(148, 163, 184, 0.08));
  color: inherit;
  font-size: 12.5px;
}
.dsh-study-btn {
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid var(--dsh-border, rgba(148, 163, 184, 0.35));
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-study-btn:hover {
  background: rgba(148, 163, 184, 0.14);
}
.dsh-study-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.dsh-study-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}
.dsh-study-badge-muted {
  background: rgba(100, 116, 139, 0.14);
  color: inherit;
  opacity: 0.85;
}
.dsh-study-badge-core {
  background: rgba(217, 119, 6, 0.15);
  color: #d97706;
}
.dsh-study-progress-track {
  height: 5px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
  overflow: hidden;
}
.dsh-study-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: #059669;
  transition: width 0.25s ease;
}
.dsh-study-section {
  border: 1px solid var(--dsh-border, rgba(148, 163, 184, 0.28));
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--dsh-surface, rgba(148, 163, 184, 0.05));
}
.dsh-study-section-title {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.78;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dsh-study-kv {
  margin: 4px 0;
  font-size: 12.5px;
  word-break: break-word;
}
.dsh-study-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dsh-study-card {
  border: 1px solid var(--dsh-border, rgba(148, 163, 184, 0.28));
  border-radius: 8px;
  padding: 9px 11px;
  transition: border-color 0.15s ease;
}
.dsh-study-card-active {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.06);
}
.dsh-study-card-done {
  border-color: rgba(5, 150, 105, 0.4);
}
.dsh-study-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
  font-size: 12.5px;
}
.dsh-study-card-summary {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.86;
}
.dsh-study-status-done { color: #059669; font-size: 11.5px; font-weight: 600; }
.dsh-study-status-active { color: #2563eb; font-size: 11.5px; font-weight: 600; }
.dsh-study-status-pending { opacity: 0.58; font-size: 11.5px; }
.dsh-study-md-preview {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.05);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow-y: auto;
}
.dsh-study-svg-box {
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.35);
}
.dsh-study-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-study-empty {
  padding: 18px 14px;
  border-radius: 8px;
  border: 1px dashed var(--dsh-border, rgba(148, 163, 184, 0.4));
  text-align: left;
  font-size: 12.5px;
}
`

export function injectStudyStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return
  const style = document.createElement('style')
  style.setAttribute(STYLE_ATTR, '1')
  style.textContent = CSS_TEXT
  document.head.appendChild(style)
}
