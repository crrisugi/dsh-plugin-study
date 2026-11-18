import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const enLocale = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', 'en.json'), 'utf-8'))
const zhLocale = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', 'zh.json'), 'utf-8'))
const iconBuf = fs.readFileSync(path.join(ROOT, 'assets', 'icon.svg'))

if (iconBuf.byteLength > 32 * 1024) {
  throw new Error(`assets/icon.svg exceeds 32 KiB market inline limit (${iconBuf.byteLength} bytes)`)
}

let commit = '0'.repeat(40)
let publishTimestamp = Math.floor(Date.now() / 1000)
try {
  commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim()
  const ts = execFileSync('git', ['-C', ROOT, 'show', '-s', '--format=%ct', 'HEAD'], { encoding: 'utf-8' }).trim()
  if (/^\d+$/.test(ts)) publishTimestamp = Number(ts)
} catch {
  // Fallback when run outside a git commit
}

const repoUrl = 'https://github.com/crrisugi/dsh-plugin-study'
const indexDoc = {
  format: 1,
  title: { en: 'dsh-plugin-study Feed', zh: 'dsh-plugin-study 伴学插件源' },
  description: {
    en: 'Official Format 1 market feed for dsh-plugin-study.',
    zh: 'dsh-plugin-study 官方 Format 1 市场索引源。',
  },
  metadata: {
    categories: {
      education: { title: { en: 'Education & STEM', zh: '理工伴学' } },
    },
  },
  plugins: [
    {
      name: pkg.name,
      title: { en: enLocale.meta.title, zh: zhLocale.meta.title },
      description: { en: enLocale.meta.description, zh: zhLocale.meta.description },
      icon: `data:image/svg+xml;base64,${iconBuf.toString('base64')}`,
      author: pkg.author,
      homepage: pkg.homepage,
      repository: { url: repoUrl },
      metadata: {
        category: 'education',
        keywords: pkg.keywords,
      },
      'dist-tags': { latest: pkg.version },
      versions: [
        {
          version: pkg.version,
          publishTimestamp,
          source: {
            type: 'git',
            url: repoUrl,
            commit,
          },
          engines: {
            dsh: pkg.engines?.dsh ?? '*',
          },
        },
      ],
    },
  ],
}

process.stdout.write(`${JSON.stringify(indexDoc, null, 2)}\n`)
