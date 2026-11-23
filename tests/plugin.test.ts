import * as fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { registerStudyApi } from '../src/api.js'
import { BlueprintStore, parseBlueprintMarkdown } from '../src/blueprint-store.js'
import { REFERENCE_TOPICS, WORKFLOW_TOPICS } from '../src/contract.js'
import { loadBundledSkills, parseSkillMarkdown } from '../src/skills.js'
import { createStudyTools } from '../src/tools.js'
import { isLoopbackHostname, isTrustedApiRequest } from '../src/trust-fence.js'
import { extractTagFromLocation, isStrictlyNewer, UpdateChecker } from '../src/update-checker.js'

describe('bundled skills', () => {
  it('loads study and study-feedback with modelInvocable disabled', async () => {
    const skills = await loadBundledSkills()
    expect(skills.map((s) => s.name)).toEqual(['study', 'study-feedback'])
    for (const sk of skills) {
      expect(sk.invocation?.modelInvocable).toBe(false)
      expect(sk.invocation?.userInvocable).toBe(true)
      expect(sk.content.length).toBeGreaterThan(200)
    }
    const fb = skills.find((s) => s.name === 'study-feedback')
    expect(fb?.content).toContain('crrisugi/dsh-plugin-study')
    expect(fb?.content).toContain('https://formspree.io/f/xrpqkvwl')
    expect(fb?.content).not.toContain('crrisugi/study-skill')
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

  it('distinguishes prereq _0.1 / subcard .1 numbering and avoids 0.x title collision', () => {
    const md = [
      '# 00｜学习脉络：先修与子卡编号测试',
      '> **学习材料**：ch01.md ｜ **默认深度**：标准推演',
      '- **代入的具体数值**：`a = 2, b = 3`',
      '| 卡 02_0.1 | 含参定积分（先修铺垫） | 分清外参与哑元 |',
      '| 卡 02_0.2 | 时间卷积（先修铺垫） | 算通翻转平移 |',
      '| 卡 02 | 时域本构关系 | 引入张量卷积 |',
      '| 卡 03.1_0.1 | 子卡先修（先修铺垫） | 补齐底座 |',
      '| 卡 03.1 | 机制甲 | 独立展开 |',
    ].join('\n')

    const view = parseBlueprintMarkdown(md, {
      key: 'ws:编号测试',
      fallbackTopic: '编号测试',
      archivedFiles: ['卡02_0.1_含参定积分.md', '卡02_0.5倍频采样.md', '卡03.1_0.1_子卡先修.md'],
      svgAssets: [],
      updatedAt: '2026-11-22T10:00:00.000Z',
    })

    expect(view.toyExampleValues).toBe('`a = 2, b = 3`')
    expect(view.cards.map((c) => c.id)).toEqual(['卡 02_0.1', '卡 02_0.2', '卡 02', '卡 03.1_0.1', '卡 03.1'])
    expect(view.cards[0]?.archivedName).toBe('卡02_0.1_含参定积分.md')
    expect(view.cards[1]?.status).toBe('active')
    expect(view.cards[1]?.archivedName).toBeUndefined()
    expect(view.cards[2]?.archivedName).toBe('卡02_0.5倍频采样.md')
    expect(view.cards[3]?.archivedName).toBe('卡03.1_0.1_子卡先修.md')
    expect(view.cards[4]?.archivedName).toBeUndefined()
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
      expect(cardFromSession?.inlineSvgs?.['卡01_相量.svg']).toContain('<circle')

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
      const workflowTool = tools.find((t) => t.name === 'study_read_workflow')!
      const plotTool = tools.find((t) => t.name === 'study_render_plot')!

      for (const topic of REFERENCE_TOPICS) {
        const res = (await readTool.execute({ topic }, { agent: { id: 's1' } } as never)) as { content: string }
        expect(res.content).toContain('## 1.')
        expect(res.content).toContain('## 4.')
      }

      expect(WORKFLOW_TOPICS).toContain('teaching-style')
      for (const workflow of WORKFLOW_TOPICS) {
        const res = (await workflowTool.execute({ workflow }, { agent: { id: 's1' } } as never)) as { content: string }
        expect(res.content.length).toBeGreaterThan(200)
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

      const refPlotRes = (await plotTool.execute(
        {
          rawSvg:
            '<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="400" height="160" fill="#f4f6f8"/><text x="40" y="60" font-size="13">按式 3.12 代入</text></svg>',
          svgPath: './学习伴学/测试/assets/卡01_含式号.svg',
          caption: '含式号测试',
        },
        { agent: { id: 's1' } } as never,
      )) as { warnings?: string[] }
      expect(refPlotRes.warnings?.join('\n') ?? '').toContain('原件式号或章节索引')

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

  it('validates disk links during study_sync_blueprint and reports missing files without breaking sync', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-sync-validate-'))
    try {
      const notesDir = path.join(tmpDir, '学习笔记', '校验测试')
      await fs.mkdir(path.join(notesDir, 'assets'), { recursive: true })
      await fs.writeFile(
        path.join(notesDir, '00_伴学脉络蓝图.md'),
        '# 00｜学习脉络：测试\n| 卡 01 | 基础 | 算例 |',
        'utf-8',
      )
      await fs.writeFile(
        path.join(notesDir, '卡01_基础.md'),
        '# 卡 01｜基础\n![缺失图](assets/卡01_缺失.svg)',
        'utf-8',
      )

      const store = new BlueprintStore()
      const tools = createStudyTools({
        store,
        getWorkingDirectory: () => ({ ensure: async () => tmpDir }),
      })
      const syncTool = tools.find((t) => t.name === 'study_sync_blueprint')!

      const resWithWarn = (await syncTool.execute(
        {
          topicTitle: '校验测试',
          notesDir: './学习笔记/校验测试',
          depthMode: '标准推演',
          coreProblem: '核对断链告警',
          currentCardId: '',
          cards: [
            { id: '卡 01', title: '基础', summary: '算例', status: 'done', archivedName: '卡01_基础.md' },
            { id: '卡 02', title: '进阶', summary: '漏档', status: 'done' },
          ],
        },
        { agent: { id: 's-warn' } } as never,
      )) as { syncedCards: number; warnings?: string[] }

      expect(resWithWarn.syncedCards).toBe(2)
      expect(resWithWarn.warnings).toHaveLength(2)
      expect(resWithWarn.warnings?.join('\n')).toContain('assets/卡01_缺失.svg')
      expect(resWithWarn.warnings?.join('\n')).toContain('卡 02')

      await fs.writeFile(
        path.join(notesDir, 'assets', '卡01_缺失.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
        'utf-8',
      )
      const resClean = (await syncTool.execute(
        {
          topicTitle: '校验测试',
          notesDir: './学习笔记/校验测试',
          depthMode: '标准推演',
          coreProblem: '核对断链告警',
          currentCardId: '',
          cards: [{ id: '卡 01', title: '基础', summary: '算例', status: 'done', archivedName: '卡01_基础.md' }],
        },
        { agent: { id: 's-warn' } } as never,
      )) as { syncedCards: number; warnings?: string[] }

      expect(resClean.warnings).toBeUndefined()

      await fs.writeFile(path.join(notesDir, 'assets', '卡01_原图.png'), Buffer.from('\x89PNG\r\n\x1a\nfake', 'binary'))
      await fs.writeFile(
        path.join(notesDir, '卡01_基础.md'),
        '# 卡 01｜基础（原位置：第 3.2 节）\n\n## 引出核心式\n\n由式 3.12 可得，详见原书补充推导。\n\n![原图](assets/卡01_原图.png)\n',
        'utf-8',
      )
      const resWithIndexWarn = (await syncTool.execute(
        {
          topicTitle: '校验测试',
          notesDir: './学习笔记/校验测试',
          depthMode: '标准推演',
          coreProblem: '核对原图与原件索引告警',
          currentCardId: '',
          cards: [{ id: '卡 01', title: '基础', summary: '算例', status: 'done', archivedName: '卡01_基础.md' }],
        },
        { agent: { id: 's-warn' } } as never,
      )) as { warnings?: string[] }
      expect(resWithIndexWarn.warnings).toHaveLength(1)
      expect(resWithIndexWarn.warnings?.[0]).toContain('式 3.12')

      const cardWithBitmap = await store.readArchivedCard({
        key: 'session:s-warn',
        archivedName: '卡01_基础.md',
        sessionId: 's-warn',
      })
      expect(cardWithBitmap?.inlineImages?.['卡01_原图.png']).toMatch(/^data:image\/png;base64,/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('update checker & overview passthrough', () => {
  it('compares semver strictly and parses GitHub release tag redirects', () => {
    expect(isStrictlyNewer('0.2.1', '0.2.0')).toBe(true)
    expect(isStrictlyNewer('0.2.0', '0.2.0')).toBe(false)
    expect(isStrictlyNewer('0.2.0', '0.3.0')).toBe(false)
    expect(isStrictlyNewer('0.2.0', '0.2.0-rc.1')).toBe(true)
    expect(isStrictlyNewer('0.2.0-rc.1', '0.2.0')).toBe(false)
    expect(extractTagFromLocation('https://github.com/crrisugi/dsh-plugin-study/releases/tag/v0.3.0')).toBe('v0.3.0')
    expect(extractTagFromLocation('https://github.com/crrisugi/dsh-plugin-study/releases')).toBeNull()
  })

  it('probes GitHub 302 Location, respects TTL/negative cache, falls back to npm, and handles opt-out & failures', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-update-test-'))
    try {
      const cachePath = path.join(tmpDir, 'update-check.json')
      let clock = 1_700_000_000_000
      let fetchCalls = 0

      const checker = new UpdateChecker({
        currentVersion: '0.2.0',
        cachePath,
        env: {},
        now: () => clock,
        fetchFn: async () => {
          fetchCalls += 1
          return new Response(null, {
            status: 302,
            headers: { location: 'https://github.com/crrisugi/dsh-plugin-study/releases/tag/v0.3.0' },
          })
        },
      })

      const first = await checker.checkNow()
      expect(first.updateAvailable).toBe(true)
      expect(first.latestVersion).toBe('0.3.0')
      expect(first.releaseUrl).toBe('https://github.com/crrisugi/dsh-plugin-study/releases/tag/v0.3.0')
      expect(fetchCalls).toBe(1)

      // Within 24h TTL: uses cache without calling fetch
      clock += 60_000
      const cached = await checker.checkNow()
      expect(cached.latestVersion).toBe('0.3.0')
      expect(fetchCalls).toBe(1)

      // Dev-ahead installation never triggers downgrade prompt
      const aheadChecker = new UpdateChecker({
        currentVersion: '0.4.0',
        cachePath,
        env: {},
        now: () => clock,
        fetchFn: async () => {
          throw new Error('should not hit network while cache valid')
        },
      })
      await aheadChecker.loadFromCache()
      expect(aheadChecker.getStatus().updateAvailable).toBe(false)

      // GitHub 404 fallback to npm dist-tags
      const npmCache = path.join(tmpDir, 'npm-fallback.json')
      const npmChecker = new UpdateChecker({
        currentVersion: '0.2.0',
        cachePath: npmCache,
        env: {},
        now: () => clock,
        fetchFn: async (input) => {
          const url = String(input)
          if (url.includes('releases/latest')) {
            return new Response(null, { status: 404 })
          }
          return new Response(JSON.stringify({ latest: '0.3.1' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      })
      const npmRes = await npmChecker.checkNow()
      expect(npmRes.updateAvailable).toBe(true)
      expect(npmRes.latestVersion).toBe('0.3.1')

      // Network failure fail-open + 6h negative cache
      const errCache = path.join(tmpDir, 'err-cache.json')
      let errFetchCalls = 0
      const errChecker = new UpdateChecker({
        currentVersion: '0.2.0',
        cachePath: errCache,
        env: {},
        now: () => clock,
        fetchFn: async () => {
          errFetchCalls += 1
          throw new Error('network down')
        },
      })
      const errRes = await errChecker.checkNow()
      expect(errRes.updateAvailable).toBe(false)
      expect(errFetchCalls).toBe(2) // HEAD releases/latest + npm fallback
      clock += 60_000
      await errChecker.checkNow()
      expect(errFetchCalls).toBe(2) // negative cache prevented retry

      // Opt-out env var suppresses network checks completely
      let optOutCalls = 0
      const optOutChecker = new UpdateChecker({
        currentVersion: '0.2.0',
        cachePath: path.join(tmpDir, 'opt-out.json'),
        env: { DSH_STUDY_NO_UPDATE_CHECK: '1' },
        fetchFn: async () => {
          optOutCalls += 1
          return new Response(null, { status: 302 })
        },
      })
      await optOutChecker.checkNow(true)
      expect(optOutCalls).toBe(0)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('exposes update status in /overview API response', async () => {
    const store = new BlueprintStore()
    let registeredHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void> | void) | undefined
    registerStudyApi(
      {
        register(route) {
          registeredHandler = route.handler
          return () => {}
        },
      },
      {
        store,
        getUpdateInfo: () => ({
          currentVersion: '0.2.0',
          latestVersion: '0.3.0',
          updateAvailable: true,
          releaseUrl: 'https://github.com/crrisugi/dsh-plugin-study/releases/tag/v0.3.0',
          checkedAt: '2026-11-20T07:00:00.000Z',
        }),
      },
    )

    let statusCode = 0
    let bodyText = ''
    const mockReq = {
      method: 'GET',
      url: '/study-plugin/api/overview',
      headers: { host: '127.0.0.1:4321' },
    } as unknown as IncomingMessage
    const mockRes = {
      setHeader: () => {},
      end: (chunk?: string) => {
        bodyText = chunk ?? ''
      },
      set statusCode(code: number) {
        statusCode = code
      },
      get statusCode() {
        return statusCode
      },
    } as unknown as ServerResponse

    await registeredHandler?.(mockReq, mockRes)
    expect(statusCode).toBe(200)
    const json = JSON.parse(bodyText) as { ok: boolean; update?: { latestVersion: string; updateAvailable: boolean } }
    expect(json.ok).toBe(true)
    expect(json.update?.updateAvailable).toBe(true)
    expect(json.update?.latestVersion).toBe('0.3.0')
  })
})
