import { Player } from '@/interfaces/Player.interface'
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react'
import PencilIcon from '@/components/icons/PencilIcon'
import CheckIcon from '../icons/CheckIcon'
import { useTeamsStore } from '@/store/useTeamsStore'
import { cn } from '@/lib/utils'

type Props = {
  player: Player
  className?: string
}

export default function PlayerName({ player, className }: Props) {
  const { editPlayerName } = useTeamsStore()

  const inputRef = useRef<HTMLParagraphElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [playerName, setPlayerName] = useState(player.name)

  const toggleIsEditing = () => setIsEditing(!isEditing)

  const handleConfirmEdit = (id: string, name: string) => {
    editPlayerName(id, name)
    toggleIsEditing()
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

  // Update playerName state if player.name changes somewhere else
  useEffect(() => {
    setPlayerName(player.name)
  }, [player.name])

  return (
    <section
      className={cn('flex w-full items-center justify-between', className)}
    >
      {isEditing ? (
        <>
          <div
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            ref={inputRef}
            className="min-w-fit rounded-md px-0.5 focus:outline-none focus:ring-0"
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
          <p className="max-w-1/3 text-base">{playerName}</p>
          <PencilIcon onClick={toggleIsEditing} />
        </>
      )}
    </section>
  )
}
