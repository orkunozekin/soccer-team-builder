'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminNav } from '@/components/admin/AdminNav'
import {
  CreateSavedLocationCard,
  SavedLocationCard,
} from '@/components/admin/SavedLocationManager'
import { Card, CardContent } from '@/components/ui/card'
import { getAllSavedLocations } from '@/lib/services/savedLocationService'
import type { SavedLocation } from '@/types/savedLocation'

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [loading, setLoading] = useState(true)

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getAllSavedLocations()
      setLocations(list)
    } catch (error) {
      console.error('Error fetching saved locations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Locations
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Save venues once and pick them when creating or editing matches
        </p>
      </div>

      <div className="space-y-6">
        <CreateSavedLocationCard onCreated={loadLocations} />

        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Saved locations
          </h2>

          {loading ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  Loading locations…
                </p>
              </CardContent>
            </Card>
          ) : locations.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-center text-zinc-600 dark:text-zinc-400">
                  No saved locations yet. Add one above or run the migration
                  script to import venues from past matches.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {locations.map(location => (
                <SavedLocationCard
                  key={location.id}
                  location={location}
                  onUpdated={loadLocations}
                  onDeleted={loadLocations}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
