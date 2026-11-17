import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BlueprintStore, parseBlueprintMarkdown } from '../src/blueprint-store.js'
import { REFERENCE_TOPICS } from '../src/contract.js'
import { loadBundledSkills, parseSkillMarkdown } from '../src/skills.js'
import { createStudyTools } from '../src/tools.js'
import { isLoopbackHostname, isTrustedApiRequest } from '../src/trust-fence.js'

describe('bundled skills', () => {
  it('loads study and study-feedback with modelInvocable disabled', async () => {
    const skills = await loadBundledSkills()
    expect(skills.map((s) => s.name)).toEqual(['study', 'study-feedback'])
    for (const sk of skills) {
      expect(sk.invocation?.modelInvocable).toBe(false)
      expect(sk.invocation?.userInvocable).toBe(true)
      expect(sk.content.length).toBeGreaterThan(200)
    }
  })

  it('parses frontmatter fields accurately', () => {
    const parsed = parseSkillMarkdown('---\nname: demo\ndisable-model-invocation: true\ndescription: >-\n  line one\n  line two\n---\n# Body')
    expect(parsed.name).toBe('demo')
    expect(parsed.disableModelInvocation).toBe(true)
    expect(parsed.description).toBe('line one line two')
    expect(parsed.content).toBe('# Body')
  })
})

describe('blueprint store & markdown parser', () => {
  it('parses 00_伴学脉络蓝图.md and marks archived vs active cards', () => {
    const md = [
      '# 00｜学习脉络：傅里叶衍射基础',
      '> **学习材料**：ch02.pdf ｜ **默认深度**：标准推演',
      '- **核心问题**：理解角谱传播算子如何把空间卷积变成频域相乘。',
      '- **最小输入与范围设定**：二维方孔 `[0, 2]×[0, 2]`',
      '- **固定代入的具体数值**：`k0 = 2, z = 1`',
      '| 卡 01 | 空间脉冲响应 | 算清自由空间核函数 |',
      '| 卡 02 | 角谱传递函数（核心） | 切入频域看清倏逝波截断 |',
    ].join('\n')

    const view = parseBlueprintMarkdown(md, {
      key: 'ws:傅里叶衍射',
      fallbackTopic: '傅里叶衍射',
      archivedFiles: ['卡01_空间脉冲响应.md'],
      svgAssets: ['卡01_传播核.svg'],
      updatedAt: '2026-11-16T12:00:00.000Z',
    })

    expect(view.topicTitle).toBe('傅里叶衍射基础')
    expect(view.depthMode).toBe('标准推演')
    expect(view.currentCardId).toBe('卡 02')
    expect(view.cards[0]?.status).toBe('done')
    expect(view.cards[1]?.status).toBe('active')
    expect(view.cards[1]?.isCore).toBe(true)
  })

  it('syncs session blueprints and reads workspace blueprints safely', async () => {
    const store = new BlueprintStore()
    const synced = store.syncSessionBlueprint({
      sessionId: 'sess-1',
      topicTitle: '矩阵求导',
      depthMode: '标准推演',
      coreProblem: '核对广播求和梯度',
      currentCardId: '卡 01',
      cards: [{ id: '卡 01', title: '广播梯度', summary: '沿复制轴求和' }],
    })
    expect(synced.currentCardId).toBe('卡 01')

    const list = await store.listBlueprints({ sessionId: 'sess-1' })
    expect(list).toHaveLength(1)
    expect(list[0]?.key).toBe('session:sess-1')
  })

  it('supports custom relative notesDir and rejects path traversal', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-notesdir-test-'))
    try {
      const customDir = path.join(tmpDir, 'notes', '光学专题')
      await fs.mkdir(path.join(customDir, 'assets'), { recursive: true })
      await fs.writeFile(
        path.join(customDir, '00_伴学脉络蓝图.md'),
        '# 00｜学习脉络：角谱衍射\n> **学习材料**：spw.md ｜ **默认深度**：标准推演\n| 卡 01 | 初值分解 | 算清二维拆谱 |',
        'utf-8',
      )
      await fs.writeFile(
        path.join(customDir, '卡01_初值分解.md'),
        '# 卡 01｜初值分解\n\n- 核心结论\n![相量图](assets/卡01_相量.svg)',
        'utf-8',
      )
      await fs.writeFile(
        path.join(customDir, 'assets', '卡01_相量.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="3"/></svg>',
        'utf-8',
      )

      const store = new BlueprintStore()
      store.recordSessionCwd('sess-custom', tmpDir)
      store.syncSessionBlueprint({
        sessionId: 'sess-custom',
        topicTitle: '角谱衍射',
        notesDir: './notes/光学专题',
        depthMode: '标准推演',
        coreProblem: '理解平面波谱拆解',
        currentCardId: '卡 01',
        cards: [{ id: '卡 01', title: '初值分解', summary: '算清二维拆谱', status: 'done' }],
      })

      const views = await store.listBlueprints({ sessionId: 'sess-custom', cwd: tmpDir })
      const sessionView = views.find((v) => v.key === 'session:sess-custom')
      const wsView = views.find((v) => v.key === 'ws:notes/光学专题')
      expect(sessionView?.cards[0]?.archivedName).toBe('卡01_初值分解.md')
      expect(sessionView?.svgAssets).toContain('卡01_相量.svg')
      expect(wsView?.cards[0]?.archivedName).toBe('卡01_初值分解.md')

      const cardFromSession = await store.readArchivedCard({
        key: 'session:sess-custom',
        archivedName: '卡01_初值分解.md',
        sessionId: 'sess-custom',
      })
      const cardFromWs = await store.readArchivedCard({
        key: 'ws:notes/光学专题',
        archivedName: '卡01_初值分解.md',
        cwd: tmpDir,
      })
      expect(cardFromSession?.title).toContain('初值分解')
      expect(cardFromWs?.svgRefs).toEqual(['卡01_相量.svg'])

      const svg = await store.readSvgAsset({
        key: 'ws:notes/光学专题',
        assetName: '卡01_相量.svg',
        cwd: tmpDir,
      })
      expect(svg).toContain('<circle')

      store.syncSessionBlueprint({
        sessionId: 'sess-bad',
        topicTitle: '越界测试',
        notesDir: '../outside',
        depthMode: '标准推演',
        coreProblem: '拦截父级越界路径',
        cards: [],
      })
      const blockedCard = await store.readArchivedCard({
        key: 'session:sess-bad',
        archivedName: '卡01_初值分解.md',
        cwd: tmpDir,
      })
      expect(blockedCard).toBeNull()
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('trust fence', () => {
  it('allows loopback hosts and rejects external origins', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('evil.example.com')).toBe(false)

    expect(isTrustedApiRequest({ headers: { host: '127.0.0.1:4321', origin: 'http://127.0.0.1:4321' } })).toBe(true)
    expect(isTrustedApiRequest({ headers: { host: 'localhost:4321', origin: 'https://evil.com' } })).toBe(false)
    expect(isTrustedApiRequest({ headers: { host: 'localhost:4321', 'sec-fetch-site': 'cross-site' } })).toBe(false)
  })
})

describe('study tools', () => {
  it('reads all 10 bundled references and sanitizes rawSvg output', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-study-test-'))
    try {
      const store = new BlueprintStore()
      const tools = createStudyTools({
        store,
        getWorkingDirectory: () => ({ ensure: async () => tmpDir }),
      })
      const readTool = tools.find((t) => t.name === 'study_read_reference')!
      const plotTool = tools.find((t) => t.name === 'study_render_plot')!

      for (const topic of REFERENCE_TOPICS) {
        const res = (await readTool.execute({ topic }, { agent: { id: 's1' } } as never)) as { content: string }
        expect(res.content).toContain('## 1.')
        expect(res.content).toContain('## 4.')
      }

      const plotRes = (await plotTool.execute(
        {
          rawSvg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10" onclick="alert(2)"/></svg>',
          svgPath: './学习笔记/测试/assets/卡01_状态.svg',
          caption: '状态图',
        },
        { agent: { id: 's1' } } as never,
      )) as { path: string; markdownImage: string }

      expect(plotRes.path).toBe('./学习笔记/测试/assets/卡01_状态.svg')
      expect(plotRes.markdownImage).toBe('![状态图](./学习笔记/测试/assets/卡01_状态.svg)')
      const written = await fs.readFile(path.join(tmpDir, '学习笔记/测试/assets/卡01_状态.svg'), 'utf-8')
      expect(written).not.toContain('<script')
      expect(written).not.toContain('onclick')

      await expect(
        plotTool.execute(
          {
            rawSvg: '<svg xmlns="http://www.w3.org/2000/svg"><text style="font-family:STIXNonUnicode">\uE242</text></svg>',
          },
          { agent: { id: 's1' } } as never,
        ),
      ).rejects.toThrow(/STIXNonUnicode/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
