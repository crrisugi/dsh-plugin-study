import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS_DIR = path.join(ROOT, 'assets')
const REFS_DIR = path.join(ASSETS_DIR, 'references')
const WORKFLOWS_DIR = path.join(ASSETS_DIR, 'workflows')
const STUDY_MD = path.join(ASSETS_DIR, 'skills', 'study', 'SKILL.md')
const FEEDBACK_MD = path.join(ASSETS_DIR, 'skills', 'study-feedback', 'SKILL.md')
const PLOT_HELPER = path.join(ASSETS_DIR, 'python', 'plot_helper.py')
const CHECK_SVG = path.join(ASSETS_DIR, 'python', 'check_svg.py')
const CHECK_NOTES = path.join(ASSETS_DIR, 'python', 'check_notes.py')

const errors = []

const studyRaw = fs.readFileSync(STUDY_MD, 'utf-8')
const studyLines = studyRaw.split(/\r?\n/)
const studyChars = studyLines.reduce((acc, line) => acc + line.length, 0)
if (studyLines.length > 200) {
  errors.push(`assets/skills/study/SKILL.md 行数超限: ${studyLines.length} > 200`)
}
if (studyChars > 12500) {
  errors.push(`assets/skills/study/SKILL.md 总字数超限: ${studyChars} > 12500`)
}

const fbRaw = fs.readFileSync(FEEDBACK_MD, 'utf-8')
const fbLines = fbRaw.split(/\r?\n/)
if (fbLines.length > 85) {
  errors.push(`assets/skills/study-feedback/SKILL.md 行数超限: ${fbLines.length} > 85`)
}

function stripCodeAndTemplates(mdText) {
  let head = mdText.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, '')
  head = head.split('## 产出文档模板')[0] ?? head
  head = head.replace(/```[\s\S]*?```/g, '')
  head = head.replace(/`[^`]*`/g, '')
  return head
}

const diskWfs = fs.existsSync(WORKFLOWS_DIR)
  ? fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.md')).sort()
  : []
const linkedWfs = [...new Set([...studyRaw.matchAll(/\(workflows\/([a-zA-Z0-9_-]+\.md)\)/g)].map((m) => m[1]))].sort()
if (JSON.stringify(diskWfs) !== JSON.stringify(linkedWfs)) {
  errors.push(`专项流程路由双向对齐失败: disk=${diskWfs.join(',')} vs linked=${linkedWfs.join(',')}`)
}
for (const file of diskWfs) {
  const txt = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8')
  const lines = txt.split(/\r?\n/).filter((_, i, arr) => i < arr.length - 1 || txt.split(/\r?\n/).at(-1) !== '')
  if (lines.length < 20 || lines.length > 80) {
    errors.push(`workflows/${file} 行数越界: ${lines.length} (要求 20~80)`)
  }
}

const proseDocs = [
  ['assets/skills/study/SKILL.md', studyRaw],
  ['assets/skills/study-feedback/SKILL.md', fbRaw],
  ...diskWfs.map((file) => [`assets/workflows/${file}`, fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8')]),
]
for (const [label, raw] of proseDocs) {
  const prose = stripCodeAndTemplates(raw)
  if (/[！!]/.test(prose)) {
    errors.push(`${label} 正文含禁用感叹号`)
  }
  const longParen = /（([^）]{16,})）/.exec(prose)
  if (longParen) {
    errors.push(`${label} 含超长圆括号补丁 (>15字): （${longParen[1].slice(0, 18)}...）`)
  }
}

const diskRefs = fs.readdirSync(REFS_DIR).filter((f) => f.endsWith('.md')).sort()
const linkedRefs = [...new Set([...studyRaw.matchAll(/\(references\/([a-zA-Z0-9_-]+\.md)\)/g)].map((m) => m[1]))].sort()
if (JSON.stringify(diskRefs) !== JSON.stringify(linkedRefs)) {
  errors.push(`表征路由双向对齐失败: disk=${diskRefs.join(',')} vs linked=${linkedRefs.join(',')}`)
}

for (const file of diskRefs) {
  const txt = fs.readFileSync(path.join(REFS_DIR, file), 'utf-8')
  const lines = txt.split(/\r?\n/).filter((_, i, arr) => i < arr.length - 1 || txt.split(/\r?\n/).at(-1) !== '')
  if (lines.length < 15 || lines.length > 35) {
    errors.push(`${file} 行数越界: ${lines.length} (要求 15~35)`)
  }
  const slots = [...txt.matchAll(/^## (\d+)\.\s+\S+/gm)].map((m) => m[1])
  if (JSON.stringify(slots) !== JSON.stringify(['1', '2', '3', '4'])) {
    errors.push(`${file} 缺失标准四槽标题: ${slots.join(',')}`)
  }
}

for (const reqFile of [
  PLOT_HELPER,
  CHECK_SVG,
  CHECK_NOTES,
  path.join(ASSETS_DIR, 'python', 'pyproject.toml'),
  path.join(ASSETS_DIR, 'python', 'uv.lock'),
  path.join(ASSETS_DIR, 'icon.svg'),
  path.join(ROOT, 'locale', 'en.json'),
  path.join(ROOT, 'locale', 'zh.json'),
]) {
  if (!fs.existsSync(reqFile)) {
    errors.push(`缺失核心发版资产: ${path.relative(ROOT, reqFile)}`)
  }
}

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
if (!pkgJson.engines?.dsh) {
  errors.push('package.json 缺失 engines.dsh 声明（DSH Market Format 1 必填）')
}
const iconPath = path.join(ASSETS_DIR, 'icon.svg')
if (fs.existsSync(iconPath) && fs.statSync(iconPath).size > 32 * 1024) {
  errors.push('assets/icon.svg 体积超过 32 KiB 市场内联上限')
}
for (const lang of ['en', 'zh']) {
  const locFile = path.join(ROOT, 'locale', `${lang}.json`)
  if (fs.existsSync(locFile)) {
    const loc = JSON.parse(fs.readFileSync(locFile, 'utf-8'))
    if (!loc?.meta?.title) {
      errors.push(`locale/${lang}.json 缺失 meta.title`)
    }
  }
}

const privRe = /(?:[A-Za-z]:[/\\]Users[/\\]|\/(?:Users|home)\/[a-zA-Z0-9_\u4e00-\u9fa5]+)/i
for (const dir of [path.join(ROOT, 'src'), ASSETS_DIR]) {
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '.venv' || entry.name === '__pycache__') {
          errors.push(`禁止残留私有环境目录: ${path.relative(ROOT, full)}`)
          continue
        }
        walk(full)
      } else if (/\.(md|ts|tsx|py|json|yml|toml)$/i.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8')
        if (privRe.test(content)) {
          errors.push(`检测到本地隐私路径残留: ${path.relative(ROOT, full)}`)
        }
      }
    }
  }
  walk(dir)
}

if (errors.length > 0) {
  console.error('[FAIL] 资产与隐私门禁未通过:\n- ' + errors.join('\n- '))
  process.exit(1)
}

console.log(
  `[PASS] study=${studyLines.length}行/${studyChars}字 | workflows=${diskWfs.length}份双向对齐 | refs=${diskRefs.length}份四槽双向对齐 | study-feedback=${fbLines.length}行 | 隐私零残留`,
)
