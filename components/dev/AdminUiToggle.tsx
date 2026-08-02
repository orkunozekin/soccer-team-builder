'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useDevAdminUiStore } from '@/store/devAdminUiStore'

/**
 * Local-dev only: lets an admin hide admin UI to preview the player experience.
 */
export function AdminUiToggle() {
  const { roleIsAdmin, canToggleAdminUi, hideAdminUi } = useAdmin()
  const hydrate = useDevAdminUiStore(state => state.hydrate)
  const toggleHideAdminUi = useDevAdminUiStore(state => state.toggleHideAdminUi)
  const hydrated = useDevAdminUiStore(state => state.hydrated)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (!canToggleAdminUi || !roleIsAdmin || !hydrated) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={toggleHideAdminUi}
        className="h-9 border-zinc-300 bg-white/95 text-zinc-900 shadow-md backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100"
      >
        {hideAdminUi ? 'Show admin UI' : 'Hide admin UI'}
      </Button>
    </div>
  )
}
