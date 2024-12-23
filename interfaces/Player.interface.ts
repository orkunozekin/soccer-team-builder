export interface Player {
  id: string
  name: string
  position: `${PlayerPosition}`
}

export enum PlayerPosition {
  DEFENDER = 'defender',
  MIDFIELDER = 'midfielder',
  FORWARD = 'forward',
}

export interface PlayersState {
  players: Player[]
  addPlayers: (names: string[]) => void
  deletePlayer: (id: string) => void
  editPlayer: (id: string, name: string) => void
  clearPlayers: () => void
}
