import { Player } from '@/interfaces/Player.interface'
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react'
import PencilIcon from '@/components/icons/PencilIcon'
import TrashIcon from '@/components/icons/TrashIcon'
import CheckIcon from '../icons/CheckIcon'
import { useTeamsStore } from '@/store/useTeamsStore'

type Props = {
  player: Player
}

export default function PlayerName({ player }: Props) {
  const { editPlayerName, deletePlayer, removeTeamPlayer } = useTeamsStore()

  const inputRef = useRef<HTMLParagraphElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [playerName, setPlayerName] = useState(player.name)

  const toggleIsEditing = () => setIsEditing(!isEditing)

  const handleConfirmEdit = (id: string, name: string) => {
    editPlayerName(id, name)
    toggleIsEditing()
  }

  const handleRemovePlayer = (id: string) => {
    deletePlayer(id)
    removeTeamPlayer(id)
  }

  const handleEnter = (
    e: KeyboardEvent<HTMLDivElement>,
    id: string,
    name: string
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirmEdit(id, name)
    }
  }

  //focus editable input for player name onClick of edit icon
  useEffect(() => {
    const sel = window.getSelection()
    if (isEditing) {
      inputRef?.current?.focus()
      const range = document.createRange()
      const input = inputRef?.current as Node
      range.setStart(input, input?.childNodes?.length)
      range.collapse(true)
      sel?.removeAllRanges()
      return sel?.addRange(range)
    }
    sel?.removeAllRanges()
  }, [isEditing])

  return (
    <section className="flex items-center justify-between">
      {isEditing ? (
        <>
          <div
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            ref={inputRef}
            className="min-w-fit rounded-md border !border-neutral-80 px-1 focus:outline-none focus:ring-0"
            onInput={e =>
              setPlayerName(e.currentTarget.textContent || player.name)
            }
            onKeyDown={e => handleEnter(e, player.id, playerName)}
          >
            {player.name}
          </div>
          <CheckIcon onClick={() => handleConfirmEdit(player.id, playerName)} />
        </>
      ) : (
        <>
          <p className="text-sm">{playerName}</p>
          <div className="flex gap-1">
            <PencilIcon onClick={toggleIsEditing} />
            <TrashIcon onClick={() => handleRemovePlayer(player.id)} />
          </div>
        </>
      )}
    </section>
  )
}
