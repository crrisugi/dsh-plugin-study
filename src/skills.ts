import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

export interface SkillsServiceLike {
  register(skill: SkillRegistration): () => void
}

export function resolveAssetsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '..', 'assets')
}

export function parseSkillMarkdown(raw: string): {
  name: string
  description: string
  disableModelInvocation: boolean
  content: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error('Invalid SKILL.md frontmatter')
  }
  const fm = match[1]
  const body = match[2].trim()

  const nameMatch = /^name:\s*(.+)$/m.exec(fm)
  const disableMatch = /^disable-model-invocation:\s*(true|false)\s*$/m.exec(fm)
  const descBlockMatch = /^description:\s*>-\r?\n((?:[ \t]+.+\r?\n?)+)/m.exec(fm)
  const descInlineMatch = /^description:\s*(?!>-)(.+)$/m.exec(fm)

  const name = nameMatch?.[1]?.trim() ?? ''
  const disableModelInvocation = disableMatch?.[1] === 'true'
  let description = ''
  if (descBlockMatch?.[1]) {
    description = descBlockMatch[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ')
  } else if (descInlineMatch?.[1]) {
    description = descInlineMatch[1].trim()
  }

  if (!name || !description) {
    throw new Error(`Missing name or description in SKILL.md (${name})`)
  }

  return { name, description, disableModelInvocation, content: body }
}

export async function loadBundledSkills(): Promise<SkillRegistration[]> {
  const assetsDir = resolveAssetsDir()
  const skillPaths = [
    path.join(assetsDir, 'skills', 'study', 'SKILL.md'),
    path.join(assetsDir, 'skills', 'study-feedback', 'SKILL.md'),
  ]

  const registrations: SkillRegistration[] = []
  for (const filePath of skillPaths) {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = parseSkillMarkdown(raw)
    registrations.push({
      name: parsed.name,
      description: parsed.description,
      content: parsed.content,
      source: 'bundled',
      provider: 'dsh-plugin-study',
      path: filePath,
      invocation: {
        modelInvocable: !parsed.disableModelInvocation,
        userInvocable: true,
      },
    })
  }
  return registrations
}

export function registerBundledSkills(
  skillsService: SkillsServiceLike,
  definitions: readonly SkillRegistration[],
): () => void {
  const disposers = definitions.map((def) => skillsService.register(def))
  return () => {
    for (const dispose of disposers) dispose()
  }
}
