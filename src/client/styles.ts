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
  font-family: var(--dsh-font-family-text, inherit);
  font-size: var(--dsh-content-font-size, 13px);
  line-height: 1.55;
  color: var(--dsw-alias-label-primary, var(--dsh-fg, inherit));
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
  border-radius: var(--dsw-radius-sm, 6px);
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.32));
  background: var(--dsw-alias-bg-layer-1, rgba(148, 163, 184, 0.08));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12.5px;
}
.dsh-study-btn {
  padding: 4px 9px;
  border-radius: var(--dsw-radius-sm, 6px);
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.32));
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12px;
  cursor: pointer;
}
.dsh-study-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(148, 163, 184, 0.14));
}
.dsh-study-btn-primary {
  border-color: var(--dsw-alias-state-business-primary, #2563eb);
  color: var(--dsw-alias-state-business-primary, #2563eb);
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
  background: rgba(37, 99, 235, 0.14);
  color: var(--dsw-alias-state-business-primary, #3b82f6);
}
.dsh-study-badge-muted {
  background: var(--dsw-alias-bg-layer-1, rgba(100, 116, 139, 0.14));
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-study-badge-core {
  background: rgba(217, 119, 6, 0.15);
  color: #d97706;
}
.dsh-study-progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.22));
  overflow: hidden;
}
.dsh-study-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: #059669;
  transition: width 0.25s ease;
}
.dsh-study-section {
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.28));
  border-radius: var(--dsw-radius-md, 8px);
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1, rgba(148, 163, 184, 0.05));
}
.dsh-study-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, inherit);
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
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.28));
  border-radius: var(--dsw-radius-md, 8px);
  padding: 9px 11px;
  background: var(--dsw-alias-bg-base, transparent);
  transition: border-color 0.15s ease;
}
.dsh-study-card-active {
  border-color: var(--dsw-alias-state-business-primary, #2563eb);
  background: rgba(37, 99, 235, 0.07);
}
.dsh-study-card-done {
  border-color: rgba(5, 150, 105, 0.42);
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
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-study-status-done { color: #059669; font-size: 11.5px; font-weight: 600; }
.dsh-study-status-active { color: var(--dsw-alias-state-business-primary, #3b82f6); font-size: 11.5px; font-weight: 600; }
.dsh-study-status-pending { color: var(--dsw-alias-label-tertiary, inherit); opacity: 0.72; font-size: 11.5px; }
.dsh-study-md-preview {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-sm, 6px);
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.24));
  background: var(--dsw-alias-bg-base, rgba(148, 163, 184, 0.05));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12.5px;
  line-height: 1.62;
  max-height: 360px;
  overflow-y: auto;
  word-break: break-word;
}
.dsh-study-md-h1 { font-size: 13.5px; font-weight: 700; margin: 2px 0 8px; }
.dsh-study-md-h2 { font-size: 12.5px; font-weight: 700; margin: 10px 0 4px; }
.dsh-study-md-h3 { font-size: 12px; font-weight: 600; margin: 8px 0 4px; }
.dsh-study-md-p { margin: 4px 0; }
.dsh-study-md-hr {
  border: none;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.32));
  margin: 10px 0;
}
.dsh-study-md-quote {
  margin: 6px 0;
  padding: 6px 10px;
  border-left: 3px solid var(--dsw-alias-state-business-primary, #3b82f6);
  border-radius: 0 var(--dsw-radius-sm, 6px) var(--dsw-radius-sm, 6px) 0;
  background: var(--dsw-alias-bg-layer-1, rgba(148, 163, 184, 0.08));
}
.dsh-study-md-quote .dsh-study-md-p { margin: 3px 0; }
.dsh-study-md-li { display: flex; gap: 6px; margin: 4px 0; }
.dsh-study-md-bullet { color: var(--dsw-alias-label-tertiary, inherit); flex-shrink: 0; }
.dsh-study-md-muted { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, inherit); margin: 4px 0; }
.dsh-study-inline-code {
  font-family: var(--dsh-font-family-code, ui-monospace, monospace);
  font-size: 11.5px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-1, rgba(148, 163, 184, 0.14));
}
.dsh-study-code-block {
  margin: 6px 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.24));
  background: var(--dsw-alias-bg-layer-1, rgba(148, 163, 184, 0.1));
  font-family: var(--dsh-font-family-code, ui-monospace, monospace);
  font-size: var(--dsh-code-font-size, 11.5px);
  overflow-x: auto;
  white-space: pre;
}
.dsh-study-inline-figure {
  margin: 8px 0;
}
.dsh-study-figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-study-svg-box {
  margin-top: 6px;
  padding: 8px;
  border-radius: var(--dsw-radius-md, 8px);
  background: #f4f6f8;
  border: 1px solid var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.35));
}
.dsh-study-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-study-empty {
  padding: 18px 14px;
  border-radius: var(--dsw-radius-md, 8px);
  border: 1px dashed var(--dsw-alias-border-l3, rgba(148, 163, 184, 0.4));
  color: var(--dsw-alias-label-secondary, inherit);
  text-align: left;
  font-size: 12.5px;
}
.dsh-study-update-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-md, 8px);
  border: 1px solid rgba(37, 99, 235, 0.35);
  background: rgba(37, 99, 235, 0.08);
  font-size: 12px;
}
.dsh-study-update-banner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-weight: 600;
  color: var(--dsw-alias-state-business-primary, #3b82f6);
}
.dsh-study-update-banner-sub {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-study-update-banner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh-study-link-btn {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
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
