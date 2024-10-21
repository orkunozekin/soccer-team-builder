import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { PlayersState } from '@/interfaces/Player.interface'
import { createJSONStorage, persist } from 'zustand/middleware'

//store for all players
export const usePlayersStore = create<PlayersState>()(
  persist(
    set => ({
      players: [],

      addPlayers: names =>
        set(state => ({
          players: [
            ...state.players,
            ...names.map(name => ({
              id: uuidv4(),
              name,
            })),
          ],
        })),

      deletePlayer: id =>
        set(state => ({
          players: state.players.filter(player => player.id !== id),
        })),

      editPlayer: (id, name) =>
        set(state => ({
          players: state.players.map(player => {
            if (player.id === id) {
              player.name = name
            }
            return player
          }),
        })),

      clearPlayers: () => set({ players: [] }),
    }),
    {
      name: 'players-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
)
