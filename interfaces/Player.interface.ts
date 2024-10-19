export interface Player {
  id: string
  name: string
}

export interface PlayersState {
  players: Player[]
  addPlayers: (names: string[]) => void
  deletePlayer: (id: string) => void
  editPlayer: (id: string, name: string) => void
  clearPlayers: () => void
}
