import { Player } from '@/interfaces/Player.interface'
import React from 'react'
import PlayerName from '../player/PlayerName'
import { KebabMenuItem } from '@/interfaces/KebabMenu.interface'
import KebabMenu from '../KebabMenu'
import { cn } from '@/lib/utils'

type Props = {
  player: Player
  kebabMenuItems: KebabMenuItem[]
  className?: string
}

const PlayersRowItem = ({ player, kebabMenuItems, className = '' }: Props) => {
  return (
    <div className={cn('flex items-center justify-between gap-1', className)}>
      <PlayerName player={player} />
      <KebabMenu kebabMenuItems={kebabMenuItems} />
    </div>
  )
}

export default PlayersRowItem
