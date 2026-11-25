import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { BlueprintStore } from './blueprint-store.js'
import {
  REFERENCE_TOPICS,
  WORKFLOW_TOPICS,
  type CardStatus,
  type ProbeStatus,
  type ReferenceTopic,
  type WorkflowTopic,
} from './contract.js'
import { resolveAssetsDir } from './skills.js'

export interface ToolsServiceLike {
  register(tool: ToolDefinition): () => void
}

export interface WorkingDirectoryServiceLike {
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>
}

function sessionOf(exec: unknown): string {
  const agent = (exec as { agent?: { id?: unknown } } | undefined)?.agent
  return typeof agent?.id === 'string' && agent.id.length > 0 ? agent.id : 'default'
}

function stripDangerousSvgMarkup(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
}

function assertNoPrivateGlyphs(svg: string): void {
  if (svg.includes('STIXNonUnicode') || /[\uE000-\uF8FF]/.test(svg)) {
    throw new Error(
      'SVG 包含浏览器不可见的 STIXNonUnicode / 私有区缺字（常见于 Matplotlib 的 \\mathcal/\\mathscr/\\mathbb），请改用常规字母如 V_I、V_II 后重试。',
    )
  }
}

function resolveSafeOutputSvgPath(cwd: string, svgPath: string | undefined, fallbackName: string): {
  absPath: string
  displayPath: string
  assetName: string
} {
  if (!svgPath || !svgPath.trim()) {
    const tmpDir = path.join(os.tmpdir(), 'dsh-plugin-study-plots')
    const absPath = path.join(tmpDir, fallbackName)
    return {
      absPath,
      displayPath: absPath.replace(/\\/g, '/'),
      assetName: fallbackName,
    }
  }
  const normalized = svgPath.trim()
  if (!normalized.toLowerCase().endsWith('.svg')) {
    throw new Error('svgPath must end with .svg')
  }
  const absCwd = path.resolve(cwd)
  const resolved = path.resolve(absCwd, normalized)
  const rel = path.relative(absCwd, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('svgPath must stay within the current workspace directory')
  }
  return {
    absPath: resolved,
    displayPath: './' + rel.replace(/\\/g, '/'),
    assetName: path.basename(resolved),
  }
}

function runProcess(
  cmd: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], {
      env,
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function runUvPython(projectDir: string, scriptPath: string, signal?: AbortSignal): Promise<{ code: number; stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    STUDY_NO_UPDATE_CHECK: '1',
    UV_PROJECT_ENVIRONMENT: path.join(os.tmpdir(), 'dsh-plugin-study-uv-venv'),
  }
  return runProcess('uv', ['run', '--project', projectDir, scriptPath], env, signal)
}

async function runCheckSvgScript(pyProjectDir: string, svgAbsPath: string, signal?: AbortSignal): Promise<string[]> {
  const checkScript = path.join(pyProjectDir, 'check_svg.py')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONIOENCODING: 'utf-8',
  }
  const candidates: Array<[string, string[]]> = [
    ['python', [checkScript, svgAbsPath]],
    ['python3', [checkScript, svgAbsPath]],
    ['uv', ['run', '--project', pyProjectDir, 'python', checkScript, svgAbsPath]],
  ]
  for (const [cmd, args] of candidates) {
    try {
      const res = await runProcess(cmd, args, env, signal)
      if (res.code === 0) return []
      const raw = (res.stderr || res.stdout).trim()
      return raw
        .split(/\r?\n/)
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter((line) => line.length > 0 && !line.startsWith('[FAIL]'))
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') continue
      return []
    }
  }
  return []
}

export function createStudyTools(opts: {
  store: BlueprintStore
  getWorkingDirectory?: (() => WorkingDirectoryServiceLike | undefined) | undefined
}): ToolDefinition[] {
  const assetsDir = resolveAssetsDir()
  const refsDir = path.join(assetsDir, 'references')
  const workflowsDir = path.join(assetsDir, 'workflows')
  const pyProjectDir = path.join(assetsDir, 'python')

  const readReferenceTool = defineTool({
    name: 'study_read_reference',
    description:
      '按需读取内置的 10 份理工伴学草稿纸表征规范（单张伴学卡默认读 1 份，跨表征时最多组合读 2 份）。',
    parameters: {
      topic: {
        type: 'string',
        enum: [...REFERENCE_TOPICS],
        required: true,
        description: '表征文件名（不含 .md 后缀），如 continuous-operator、tensor-array 等。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string', required: true },
          content: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.content }],
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const topic = args.topic as ReferenceTopic
      if (!REFERENCE_TOPICS.includes(topic)) {
        throw new Error(`Unknown reference topic: ${String(args.topic)}`)
      }
      const refPath = path.join(refsDir, `${topic}.md`)
      const content = await fs.readFile(refPath, 'utf-8')
      return { topic, content }
    },
  })

  const readWorkflowTool = defineTool({
    name: 'study_read_workflow',
    description:
      '按需读取内置的 4 份伴学专项流程细则：long-corpus（百页长卷总图）、plotting（原图搬运与绘图快检）、archiving（自然讲义落盘与骨架示例）、teaching-style（清朗书面讲义语言风格卡）。',
    parameters: {
      workflow: {
        type: 'string',
        enum: [...WORKFLOW_TOPICS],
        required: true,
        description: '流程文件名（不含 .md 后缀）：long-corpus、plotting、archiving 或 teaching-style。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workflow: { type: 'string', required: true },
          content: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.content }],
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const workflow = args.workflow as WorkflowTopic
      if (!WORKFLOW_TOPICS.includes(workflow)) {
        throw new Error(`Unknown workflow topic: ${String(args.workflow)}`)
      }
      const wfPath = path.join(workflowsDir, `${workflow}.md`)
      const content = await fs.readFile(wfPath, 'utf-8')
      return { workflow, content }
    },
  })

  const renderPlotTool = defineTool({
    name: 'study_render_plot',
    description:
      '在受控沙箱中调用内置 plot_helper.py（经 uv）或写入手写圆角状态 <svg>，导出紧凑 .svg 矢量图并返回 Markdown 引用路径。',
    timeoutMs: 60_000,
    parameters: {
      plotCode: {
        type: 'string',
        description:
          'Python 绘图代码（已预导入 numpy as np、matplotlib.pyplot as plt、plot_helper as ph；将最终画布赋给变量 fig 即可自动导出）。与 rawSvg 二选一。',
      },
      rawSvg: {
        type: 'string',
        description: '用于代码分支、指针重连或模块时序的柔和浅底圆角 <svg>...</svg> 矢量源码。与 plotCode 二选一。',
      },
      svgPath: {
        type: 'string',
        description:
          '工作区相对保存路径（仅确认落盘时使用，如 ./学习伴学/傅里叶光学/assets/卡01_相量.svg）。讲卡展示、靶向直答与纯会话伴读省略以存入临时目录。',
      },
      caption: {
        type: 'string',
        description: '简短图注文字，用于拼装返回的 ![图注](路径)。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          bytes: { type: 'number', required: true },
          markdownImage: { type: 'string', required: true },
          stdout: { type: 'string' },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: 'plot_helper 或 check_svg.py 返回的布局碰撞、配色与原件索引自检提醒。',
          },
        },
      },
      render: (_args, value) => {
        const lines = [`SVG generated (${value.bytes} bytes): ${value.markdownImage}`]
        if (typeof value.stdout === 'string' && value.stdout.trim()) {
          lines.push(`脚本输出：\n${value.stdout.trim()}`)
        }
        const warnList = Array.isArray(value.warnings) ? value.warnings : []
        if (warnList.length > 0) {
          lines.push(`SVG 快检提醒（请按提示修正后重画）：\n- ${warnList.join('\n- ')}`)
        }
        return [{ type: 'text', text: lines.join('\n\n') }]
      },
    },
    execute: async (args, exec) => {
      const sessionId = sessionOf(exec)
      const wdSvc = opts.getWorkingDirectory?.()
      const cwd = wdSvc ? await wdSvc.ensure((exec as { agent?: unknown }).agent, exec.signal) : process.cwd()
      opts.store.recordSessionCwd(sessionId, cwd)

      const fallbackName = `study_plot_${Date.now()}.svg`
      const target = resolveSafeOutputSvgPath(cwd, args.svgPath, fallbackName)
      const caption = args.caption?.trim() || '伴学矢量配图'

      let finalSvg = ''
      let scriptStdout = ''
      let warnings: string[] = []
      let isRawSvg = false
      if (args.rawSvg && args.rawSvg.trim()) {
        isRawSvg = true
        const cleaned = stripDangerousSvgMarkup(args.rawSvg.trim())
        if (!cleaned.includes('<svg')) {
          throw new Error('rawSvg must contain a valid <svg> root element')
        }
        finalSvg = cleaned
      } else if (args.plotCode && args.plotCode.trim()) {
        const tmpSandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-study-py-'))
        try {
          const pyFile = path.join(tmpSandbox, 'render_job.py')
          const tmpSvg = path.join(tmpSandbox, 'out.svg')
          const helperDirPosix = pyProjectDir.replace(/\\/g, '/')
          const tmpSvgPosix = tmpSvg.replace(/\\/g, '/')
          const wrapper = [
            'import pathlib, sys',
            `sys.path.insert(0, ${JSON.stringify(helperDirPosix)})`,
            'import numpy as np',
            'import matplotlib.pyplot as plt',
            'import plot_helper as ph',
            `__study_out_svg = pathlib.Path(${JSON.stringify(tmpSvgPosix)})`,
            args.plotCode,
            'if not __study_out_svg.exists():',
            '    _target_fig = globals().get("fig") or plt.gcf()',
            '    ph.save_svg(_target_fig, __study_out_svg)',
            '',
          ].join('\n')
          await fs.writeFile(pyFile, wrapper, 'utf-8')
          let res: { code: number; stdout: string; stderr: string }
          try {
            res = await runUvPython(pyProjectDir, pyFile, exec.signal)
          } catch (err) {
            const code = (err as NodeJS.ErrnoException).code
            if (code === 'ENOENT') {
              throw new Error('未检测到 uv 环境，请先安装 uv (https://docs.astral.sh/uv/) 后再运行科学配图。')
            }
            throw err
          }
          if (res.code !== 0) {
            throw new Error(`Python 绘图执行失败 (exit ${res.code}):\n${res.stderr || res.stdout}`)
          }
          scriptStdout = res.stdout.trim()
          if (res.stderr.includes('[plot_helper 自检提示]')) {
            warnings = res.stderr
              .split(/\r?\n/)
              .map((line) => line.replace(/^-\s*/, '').trim())
              .filter((line) => line.length > 0 && !line.includes('[plot_helper 自检提示]'))
          }
          finalSvg = await fs.readFile(tmpSvg, 'utf-8')
        } finally {
          await fs.rm(tmpSandbox, { recursive: true, force: true }).catch(() => {})
        }
      } else {
        throw new Error('Either plotCode or rawSvg must be provided')
      }

      await fs.mkdir(path.dirname(target.absPath), { recursive: true })
      assertNoPrivateGlyphs(finalSvg)
      await fs.writeFile(target.absPath, finalSvg.endsWith('\n') ? finalSvg : `${finalSvg}\n`, 'utf-8')
      if (isRawSvg) {
        warnings = await runCheckSvgScript(pyProjectDir, target.absPath, exec.signal)
      }
      opts.store.recordSessionSvg(sessionId, target.assetName, finalSvg)

      const bytes = Buffer.byteLength(finalSvg, 'utf-8')
      const markdownImage = `![${caption}](${target.displayPath})`
      return {
        path: target.displayPath,
        bytes,
        markdownImage,
        ...(scriptStdout ? { stdout: scriptStdout } : {}),
        ...(warnings.length > 0 ? { warnings } : {}),
      }
    },
  })

  const syncBlueprintTool = defineTool({
    name: 'study_sync_blueprint',
    description:
      '将当前分卡伴学的脉络蓝图与各卡完成进度同步至右侧栏「伴学脉络」抽屉（排定蓝图及每卡确认归档后调用）。',
    parameters: {
      topicTitle: {
        type: 'string',
        required: true,
        description: '伴学主题简短标题（一句话概括要搞懂什么）。',
      },
      material: {
        type: 'string',
        description: '学习材料文件名或来源简述。',
      },
      notesDir: {
        type: 'string',
        description: '当前伴学笔记的工作区相对目录（如 "./学习伴学/傅里叶衍射" 或 "./notes/傅里叶衍射"；纯会话伴读不落盘时省略）。',
      },
      depthMode: {
        type: 'string',
        enum: ['直觉速通', '标准推演', '深度精读'],
        required: true,
        description: '当前确认的默认深度档位。',
      },
      coreProblem: {
        type: 'string',
        required: true,
        description: '两三句白话概括的核心问题。',
      },
      toyExampleRange: {
        type: 'string',
        description: '可选，兼容旧版蓝图或单卡固定示例的输入范围。',
      },
      toyExampleValues: {
        type: 'string',
        description: '可选，兼容旧版蓝图或单卡固定示例的基准数值。',
      },
      currentCardId: {
        type: 'string',
        description: '当前正在推演的卡片编号（如 "卡 01"；全部结课时传空字符串）。',
      },
      cards: {
        type: 'array',
        required: true,
        description: '按从简到繁排列的卡片清单。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true, description: '如 "卡 01"、"卡 02_0.1"、"卡 01.1"' },
            title: { type: 'string', required: true, description: '卡片主题（先修卡括注“先修铺垫”；核心推导卡括注“核心”）' },
            summary: { type: 'string', required: true, description: '这一步主要搞懂什么' },
            isCore: { type: 'boolean', description: '是否为核心推导卡' },
            status: {
              type: 'string',
              enum: ['pending', 'active', 'done'],
              description: '卡片当前状态',
            },
            probeStatus: {
              type: 'string',
              enum: ['pending', 'probed', 'skipped'],
              description: '本卡前置摸底状态：probed(已摸底)、skipped(免摸底直进)、pending(待进卡探测)',
            },
            probeReason: {
              type: 'string',
              description: '简短写明是否需要摸底的判断依据（如“张量积已在前序卡确认”或“需测模态分离”）',
            },
            archivedName: {
              type: 'string',
              description: '已归档落盘的笔记文件名（如 "卡01_空间脉冲响应.md"，跳过存盘或未归档时省略）',
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          syncedCards: { type: 'number', required: true },
          activeCard: { type: 'string', required: true },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: '传入 notesDir 时顺带执行的磁盘断链与格式自检告警。',
          },
        },
      },
      render: (_args, value) => {
        const base = `已同步伴学脉络至右侧栏（共 ${value.syncedCards} 张卡，当前焦点：${value.activeCard}）`
        const warnList = Array.isArray(value.warnings) ? value.warnings : []
        const text =
          warnList.length > 0
            ? `${base}\n磁盘自检告警（请顺手核对修补）：\n- ${warnList.join('\n- ')}`
            : base
        return [{ type: 'text', text }]
      },
    },
    execute: async (args, exec) => {
      const sessionId = sessionOf(exec)
      const wdSvc = opts.getWorkingDirectory?.()
      let resolvedCwd = opts.store.getSessionCwd(sessionId)
      if (wdSvc) {
        const cwd = await wdSvc.ensure((exec as { agent?: unknown }).agent, exec.signal).catch(() => undefined)
        if (cwd) {
          resolvedCwd = cwd
          opts.store.recordSessionCwd(sessionId, cwd)
        }
      }
      const rawCards = (args.cards ?? []) as Array<{
        id: string
        title: string
        summary: string
        isCore?: boolean
        status?: CardStatus
        probeStatus?: ProbeStatus
        probeReason?: string
        archivedName?: string
      }>
      const notesDir = typeof args.notesDir === 'string' && args.notesDir.trim() ? args.notesDir.trim() : undefined
      const view = opts.store.syncSessionBlueprint({
        sessionId,
        topicTitle: String(args.topicTitle ?? ''),
        material: typeof args.material === 'string' ? args.material : undefined,
        notesDir,
        depthMode: String(args.depthMode ?? '标准推演'),
        coreProblem: String(args.coreProblem ?? ''),
        toyExampleRange: typeof args.toyExampleRange === 'string' ? args.toyExampleRange : undefined,
        toyExampleValues: typeof args.toyExampleValues === 'string' ? args.toyExampleValues : undefined,
        currentCardId: typeof args.currentCardId === 'string' && args.currentCardId ? args.currentCardId : null,
        cards: rawCards,
      })
      const warnings =
        notesDir && resolvedCwd
          ? await opts.store.validateSyncedNotes({
              cwd: resolvedCwd,
              notesDir,
              cards: view.cards,
            })
          : []
      return {
        syncedCards: view.cards.length,
        activeCard: view.currentCardId ?? '已结课',
        ...(warnings.length > 0 ? { warnings } : {}),
      }
    },
  })

  return [readReferenceTool, readWorkflowTool, renderPlotTool, syncBlueprintTool]
}

export function registerStudyTools(
  toolsService: ToolsServiceLike,
  definitions: readonly ToolDefinition[],
): () => void {
  const disposers = definitions.map((def) => toolsService.register(def))
  return () => {
    for (const dispose of disposers) dispose()
  }
}
