import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Player } from '@/interfaces/Player.interface'
import { Team, TeamColor } from '@/interfaces/Team.interface'

interface StoreState {
  players: Player[]
  teams: Team[]
  // Player-related methods
  addPlayers: (names: string[]) => void
  editPlayerName: (playerId: string, name: string) => void
  deletePlayer: (id: string) => void
  clearPlayers: () => void
  // Team-related methods
  generateTeams: (players: Player[], teamCount?: number) => void
  removeTeam: (teamId: string) => void
  reassignPlayer: (playerId: string, targetTeamId: string) => void
  removeTeamPlayer: (playerId: string) => void
  editTeamColor: (teamId: string, newColor: TeamColor) => void
  clearTeams: () => void
}

export const useTeamsStore = create<StoreState>()(
  persist(
    set => ({
      players: [],
      teams: [],

      // Player-related methods
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

      clearPlayers: () => set({ players: [] }),

      // Team-related methods
      generateTeams: (players, teamCount = 2) => {
        if (!players.length) return

        const shuffledPlayers = [...players]
        for (let i = shuffledPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffledPlayers[i], shuffledPlayers[j]] = [
            shuffledPlayers[j],
            shuffledPlayers[i],
          ]
        }

        let numberOfTeams = Math.max(
          2,
          teamCount || Math.ceil(shuffledPlayers.length / 11)
        )

        const colors = ['ORANGE', 'GREEN', 'BLUE', 'SHIRTS']
        const nameCounts: Record<string, number> = {}
        const teams: Team[] = Array.from(
          { length: numberOfTeams },
          (_, index) => {
            const baseName = colors[index % colors.length]
            // Add a number to the team name if there are multiple teams with the same name
            nameCounts[baseName] = (nameCounts[baseName] || 0) + 1
            const name =
              nameCounts[baseName] > 1
                ? `${baseName} ${nameCounts[baseName]}`
                : baseName
            return {
              id: `team-${index + 1}`,
              name: name as TeamColor,
              players: [],
              color: colors[index % colors.length] as TeamColor,
            }
          }
        )

        shuffledPlayers.forEach((player, index) => {
          teams[index % numberOfTeams].players.push(player)
        })

        set({ teams })
      },

      removeTeam: teamId =>
        set(state => ({
          teams: state.teams.filter(team => team.id !== teamId),
        })),

      reassignPlayer: (playerId, targetTeamId) =>
        set(state => {
          let playerToReassign: Player | null = null
          const updatedTeams = state.teams.map(team => {
            const filteredPlayers = team.players.filter(player => {
              if (player.id === playerId) {
                playerToReassign = player
                return false
              }
              return true
            })
            return { ...team, players: filteredPlayers }
          })

          if (playerToReassign) {
            const targetTeamIndex = updatedTeams.findIndex(
              team => team.id === targetTeamId
            )
            if (targetTeamIndex !== -1) {
              updatedTeams[targetTeamIndex].players.push(playerToReassign)
            }
          }
          return { teams: updatedTeams }
        }),

      editPlayerName: (playerId, name) =>
        set(state => {
          const updatedPlayers = state.players.map(player =>
            player.id === playerId ? { ...player, name } : player
          )
          const updatedTeams = state.teams.map(team => ({
            ...team,
            players: team.players.map(player =>
              player.id === playerId ? { ...player, name } : player
            ),
          }))
          console.log('Updated players:', updatedPlayers)
          console.log('Updated teams:', updatedTeams)
          return {
            players: updatedPlayers,
            teams: updatedTeams,
          }
        }),

      removeTeamPlayer: playerId =>
        set(state => ({
          teams: state.teams.map(team => ({
            ...team,
            players: team.players.filter(player => player.id !== playerId),
          })),
        })),

      editTeamColor: (teamId, newColor) =>
        set(state => ({
          teams: state.teams.map(team =>
            team.id === teamId
              ? {
                  ...team,
                  color: newColor,
                  name: newColor,
                }
              : team
          ),
        })),

      clearTeams: () => set({ teams: [] }),
    }),
    {
      name: 'teams-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
