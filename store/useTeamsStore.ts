import { Player } from '@/interfaces/Player.interface'
import { Team, TeamColor } from '@/interfaces/Team.interface'
import { capitalizeFirstLetter } from '@/lib/stringUtils'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface TeamsState {
  teams: Team[]
  generateTeams: (players: Player[], teamCount?: number) => void
  removeTeam: (teamId: string) => void
  reassignPlayer: (playerId: string, targetTeamId: string) => void
  editTeamPlayer: (playerId: string, name: string) => void
  removeTeamPlayer: (playerId: string) => void
  clearTeams: () => void
}

const useTeamsStore = create<TeamsState>()(
  persist(
    set => ({
      teams: [],

      generateTeams: (players, teamCount = 2) => {
        if (!players.length) return

        // Shuffle players using Fisher-Yates algorithm
        const shuffledPlayers = [...players]
        for (let i = shuffledPlayers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffledPlayers[i], shuffledPlayers[j]] = [
            shuffledPlayers[j],
            shuffledPlayers[i],
          ]
        }

        // Determine the minimum number of teams
        let numberOfTeams = teamCount
        if (!teamCount) numberOfTeams = 2
        else if (shuffledPlayers.length > 11 * teamCount) {
          numberOfTeams = Math.ceil(shuffledPlayers.length / 11)
        }

        // Ensure at least two teams are created
        numberOfTeams = Math.max(2, numberOfTeams)

        // Define possible colors for teams
        const colors = ['ORANGE', 'GREEN', 'BLUE', 'SHIRTS'] // Orange, Green, Light Blue

        // Generate teams with random colors
        const nameCounts: Record<string, number> = {}
        const teams: Team[] = Array.from(
          { length: numberOfTeams },
          (_, index) => {
            /**team name will be the color --
             * it will be capitalized and have a number appended if there are multiple teams with the same color
             */
            const baseName = colors[index % colors.length]
            nameCounts[baseName] = (nameCounts[baseName] || 0) + 1
            const name =
              nameCounts[baseName] > 1
                ? `${baseName} ${nameCounts[baseName]}`
                : baseName
            return {
              id: `team-${index + 1}`,
              name: `${capitalizeFirstLetter(name.toLowerCase()) as TeamColor}`,
              players: [],
              color: colors[index % colors.length] as TeamColor,
            }
          }
        )

        // Distribute players evenly among teams
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
          // Remove player from their current team
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

          // Add player to the target team
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

      editTeamPlayer: (playerId, name) =>
        set(state => ({
          teams: state.teams.map(team => ({
            ...team,
            players: team.players.map(player =>
              player.id === playerId ? { ...player, name } : player
            ),
          })),
        })),

      removeTeamPlayer: playerId => {
        set(state => ({
          teams: state.teams.map(team => ({
            ...team,
            players: team.players.filter(player => player.id !== playerId),
          })),
        }))
      },

      clearTeams: () => set({ teams: [] }),
    }),
    {
      name: 'teams-storage', // localStorage key
      storage: createJSONStorage(() => localStorage), // use JSON storage with localStorage
    }
  )
)

export default useTeamsStore
