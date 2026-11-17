import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { ReactNode } from 'react'
import { injectStudyStyles } from './styles.js'
import { StudyBlueprintTab, StudyBlueprintTabTitle } from './tab.js'

export const name = 'study-plugin-client'
export const inject = ['slots', 'sidebarRightTabs', 'uiSession']

export const TAB_ID = 'study-blueprint'

export function apply(ctx: Context): void {
  injectStudyStyles()

  const layout = ctx.get('layout')
  const uiSession = ctx.get('uiSession')

  ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_ID,
    title: () => '伴学脉络',
    priority: 'extension',
  })

  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register(
      { name: 'sidebar.right.pane.tab', key: TAB_ID },
      function BoundStudyTab(_props: PropsRuntime<'sidebar.right.pane.tab'>): ReactNode {
        return (
          <StudyBlueprintTab
            uiSession={uiSession}
            onOpenChat={layout ? () => layout.selectPanel(null) : undefined}
          />
        )
      },
    ),
  )

  ctx.slots.inject('sidebar.right.pane.tab.title', () =>
    ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: TAB_ID }, StudyBlueprintTabTitle),
  )
}
