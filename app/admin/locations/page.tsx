'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CreateSavedLocationCard,
  SavedLocationCard,
} from '@/components/admin/SavedLocationManager'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import {
  LIST_PAGE_SIZE,
  useClientPagination,
} from '@/lib/hooks/useClientPagination'
import { getAllSavedLocations } from '@/lib/services/savedLocationService'
import type { SavedLocation } from '@/types/savedLocation'

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const paged = useClientPagination(locations)
  const { setPage } = paged
  const [loading, setLoading] = useState(true)

  const loadLocations = useCallback(
    async (focusId?: string) => {
      setLoading(true)
      try {
        const list = await getAllSavedLocations()
        setLocations(list)
        if (focusId) {
          const index = list.findIndex(item => item.id === focusId)
          if (index >= 0) setPage(Math.floor(index / LIST_PAGE_SIZE) + 1)
        }
      } catch (error) {
        console.error('Error fetching saved locations:', error)
      } finally {
        setLoading(false)
      }
    },
    [setPage]
  )

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Super user"
        title="Locations"
        description="Save venues once and pick them when creating or editing matches"
      />

      <div className="space-y-6">
        <CreateSavedLocationCard onCreated={loadLocations} />

        <div>
          <h2 className="mb-4 font-display text-2xl font-extrabold uppercase tracking-[0.02em]">
            Saved locations
          </h2>

          {loading ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  Loading locations…
                </p>
              </CardContent>
            </Card>
          ) : locations.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground">
                  No saved locations yet. Add one above or run the migration
                  script to import venues from past matches.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {paged.items.map(location => (
                <SavedLocationCard
                  key={location.id}
                  location={location}
                  onUpdated={() => loadLocations(location.id)}
                  onDeleted={loadLocations}
                />
              ))}
            </div>
          )}
          {!loading && paged.pagination.totalPages > 1 && (
            <Pagination {...paged.pagination} itemLabel="locations" />
          )}
        </div>
      </div>
    </div>
  )
}
