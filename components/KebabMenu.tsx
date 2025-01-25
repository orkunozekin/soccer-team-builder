import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import EllipsisHorizontal from './icons/EllipsisHorizontal'
import { KebabMenuItem } from '@/interfaces/KebabMenu.interface'

type Props = {
  kebabMenuItems: KebabMenuItem[]
}

const KebabMenu = ({ kebabMenuItems }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-fit">
        {kebabMenuItems.map((item, index) => (
          <>
            <DropdownMenuItem
              key={index}
              onClick={item.onClick}
              className="flex items-center justify-center"
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label && <span>{item.label}</span>}
            </DropdownMenuItem>
            {index < kebabMenuItems.length - 1 && <DropdownMenuSeparator />}
          </>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default KebabMenu
