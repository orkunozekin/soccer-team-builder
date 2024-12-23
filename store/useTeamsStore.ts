import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Player, PlayerPosition } from '@/interfaces/Player.interface'
import { Team, TeamColor } from '@/interfaces/Team.interface'

interface StoreState {
  players: Player[]
  teams: Team[]
  // Player-related methods
  addPlayer: ({
    name,
    position,
  }: {
    name: string
    position: PlayerPosition
  }) => void
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
      addPlayer: ({ name, position }) =>
        set(state => ({
          players: [
            ...state.players,
            {
              id: uuidv4(),
              name,
              position, // User-defined position
            },
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

        // Group players by position
        const groupedPlayers: Record<string, Player[]> = {
          goalkeeper: [],
          defense: [],
          midfield: [],
          forward: [],
        }

        players.forEach(player => {
          if (groupedPlayers[player.position]) {
            groupedPlayers[player.position].push(player)
          }
        })

        // Shuffle players within each position group
        Object.keys(groupedPlayers).forEach(position => {
          const group = groupedPlayers[position]
          for (let i = group.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[group[i], group[j]] = [group[j], group[i]]
          }
        })

        // Define the number of teams
        let numberOfTeams = Math.max(
          2,
          teamCount || Math.ceil(players.length / 11)
        )

        const colors = ['ORANGE', 'GREEN', 'BLUE', 'RED', 'SHIRTS']
        const nameCounts: Record<string, number> = {}

        const teams: Team[] = Array.from(
          { length: numberOfTeams },
          (_, index) => {
            const baseName = colors[index % colors.length]
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

        // Distribute players based on positions
        Object.keys(groupedPlayers).forEach(position => {
          const playersByPosition = groupedPlayers[position]

          if (position === 'goalkeeper') {
            // Assign one goalkeeper per team
            playersByPosition.forEach((player, index) => {
              if (index < numberOfTeams) {
                teams[index].players.push(player)
              }
            })
          } else {
            // Distribute other positions evenly among teams
            playersByPosition.forEach((player, index) => {
              teams[index % numberOfTeams].players.push(player)
            })
          }
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
        set(state => ({
          teams: state.teams.map(team => ({
            ...team,
            players: team.players.map(player =>
              player.id === playerId ? { ...player, name } : player
            ),
          })),
        })),

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
