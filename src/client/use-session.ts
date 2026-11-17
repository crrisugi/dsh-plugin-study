import { useSyncExternalStore } from 'react'

interface ScopeAdapterLike {
  readonly current: {
    getSnapshot(): { readonly key?: string | undefined }
    subscribe(fn: () => void): () => void
  }
}

export function useCurrentSessionId(uiSession: unknown): string | undefined {
  const adapter = (uiSession as { adapter?: ScopeAdapterLike } | undefined)?.adapter
  const key = useSyncExternalStore(
    (onChange) => adapter?.current.subscribe(onChange) ?? (() => {}),
    () => adapter?.current.getSnapshot().key,
    () => undefined,
  )
  return typeof key === 'string' && key.length > 0 ? key : undefined
}
