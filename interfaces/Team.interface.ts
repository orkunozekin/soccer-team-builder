import { Player } from './Player.interface'

export interface Team {
  id: string
  name: string
  players: Player[]
}
