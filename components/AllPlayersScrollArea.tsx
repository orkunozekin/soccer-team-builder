'use client'

import React, { useEffect, useState } from 'react'
import PencilIcon from '@/components/icons/PencilIcon'
import TrashIcon from '@/components/icons/TrashIcon'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayersStore } from '@/store/usePlayerStore'
import CheckIcon from './icons/CheckIcon'

export default function AllPlayersScrollArea() {
  const { players, deletePlayer, clearPlayers, editPlayer } = usePlayersStore()

  const [isEditing, setIsEditing] = useState(false)
  const [editedPlayer, setEditedPlayer] = useState('')

  const toggleIsEditing = () => setIsEditing(!isEditing)

  const handleConfirmEdit = (id: string, name: string) => {
    console.log('name', name)
    editPlayer(id, name)
    toggleIsEditing()
  }

  return (
    <>
      {players.length > 0 ? (
        <ScrollArea className="h-60 w-48 rounded-md border">
          <section className="p-4">
            <h4 className="mb-4 text-sm font-medium leading-none">
              All Players
            </h4>
            {players.map(player => (
              <section key={player.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {/* <p className="text-sm">{player.name}</p> */}
                  <div
                    contentEditable={isEditing}
                    suppressContentEditableWarning={true}
                    className="flex items-center gap-2"
                    onChange={e => {
                      console.log(e.currentTarget.textContent)
                      setEditedPlayer(
                        e.currentTarget.textContent || player.name
                      )
                    }}
                  >
                    {player.name}
                  </div>
                  {isEditing ? (
                    <CheckIcon
                      onClick={() => handleConfirmEdit(player.id, editedPlayer)}
                    />
                  ) : (
                    <div className="flex gap-1">
                      <PencilIcon onClick={toggleIsEditing} />
                      <TrashIcon onClick={() => deletePlayer(player.id)} />
                    </div>
                  )}
                </div>
                <hr className="mb-2" />
              </section>
            ))}
          </section>
        </ScrollArea>
      ) : null}
    </>
  )
}
