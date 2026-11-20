import type { Context } from '@deepseek-ai/cordis'
import { registerStudyApi, type WebServerLike } from './api.js'
import { BlueprintStore } from './blueprint-store.js'
import { loadBundledSkills, registerBundledSkills, type SkillsServiceLike } from './skills.js'
import { createStudyTools, registerStudyTools, type ToolsServiceLike, type WorkingDirectoryServiceLike } from './tools.js'
import { UpdateChecker } from './update-checker.js'

export const name = 'study-plugin'

interface HostContextSlice {
  get?(key: string): unknown
  inject?(deps: readonly string[], callback: (subCtx: HostContextSlice) => void): unknown
  effect?(fn: () => () => void): unknown
  logger?: {
    debug?(msg: string): void
    warn?(msg: string): void
  }
}

function resolveSessionCwdFromHost(host: HostContextSlice, sessionId: string): string | undefined {
  const sessions = host.get?.('sessions') as
    | { list?: { getSnapshot?: () => { byId?: Record<string, { cwd?: string }> } } }
    | undefined
  const cwd = sessions?.list?.getSnapshot?.()?.byId?.[sessionId]?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
}

export async function apply(ctx: Context): Promise<void> {
  const host = ctx as unknown as HostContextSlice
  const store = new BlueprintStore()
  const updateChecker = new UpdateChecker()
  const bundledSkills = await loadBundledSkills()
  const studyTools = createStudyTools({
    store,
    getWorkingDirectory: () => host.get?.('workingDirectory') as WorkingDirectoryServiceLike | undefined,
  })

  const mountSkills = (svc: unknown, target: HostContextSlice): void => {
    if (!svc) return
    const registerFn = () => registerBundledSkills(svc as SkillsServiceLike, bundledSkills)
    if (target.effect) target.effect(registerFn)
    else registerFn()
  }

  const mountTools = (svc: unknown, target: HostContextSlice): void => {
    if (!svc) return
    const registerFn = () => registerStudyTools(svc as ToolsServiceLike, studyTools)
    if (target.effect) target.effect(registerFn)
    else registerFn()
  }

  const mountWebApi = (svc: unknown, target: HostContextSlice): void => {
    if (!svc) return
    const registerFn = () =>
      registerStudyApi(svc as WebServerLike, {
        store,
        resolveSessionCwd: (sid) => resolveSessionCwdFromHost(host, sid),
        getUpdateInfo: () => updateChecker.getStatus(),
      })
    if (target.effect) target.effect(registerFn)
    else registerFn()
  }

  if (host.effect) host.effect(() => updateChecker.scheduleBackgroundCheck())
  else updateChecker.scheduleBackgroundCheck()

  const existingSkills = host.get?.('skills')
  if (existingSkills) mountSkills(existingSkills, host)
  else host.inject?.(['skills'], (sub) => mountSkills(sub.get?.('skills'), sub))

  const existingTools = host.get?.('tools')
  if (existingTools) mountTools(existingTools, host)
  else host.inject?.(['tools'], (sub) => mountTools(sub.get?.('tools'), sub))

  const existingWeb = host.get?.('webServer')
  if (existingWeb) mountWebApi(existingWeb, host)
  else host.inject?.(['webServer'], (sub) => mountWebApi(sub.get?.('webServer'), sub))

  host.logger?.debug?.('[dsh-plugin-study] initialized skills, deferred tools, and blueprint API')
}
