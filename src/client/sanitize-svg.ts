const FORBIDDEN_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
])

export function sanitizeSvgForPreview(rawSvg: string): string {
  if (!rawSvg || typeof DOMParser === 'undefined') {
    return ''
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) {
    return ''
  }
  const svgEl = doc.documentElement
  if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
    return ''
  }

  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      if (FORBIDDEN_TAGS.has(child.tagName.toLowerCase())) {
        child.remove()
        continue
      }
      walk(child)
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      const val = attr.value.trim().toLowerCase()
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name)
      } else if ((name === 'href' || name === 'xlink:href') && val.startsWith('javascript:')) {
        node.removeAttribute(attr.name)
      }
    }
  }

  walk(svgEl)
  svgEl.setAttribute('style', 'width:100%;height:auto;max-height:260px;display:block;margin:0 auto;')
  return svgEl.outerHTML
}
