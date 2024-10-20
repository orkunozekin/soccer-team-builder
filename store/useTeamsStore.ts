import { Player } from '@/interfaces/Player.interface'
import { Team, TeamColor } from '@/interfaces/Team.interface'
import { create } from 'zustand'

interface TeamsState {
  teams: Team[]
  generateTeams: (
    players: Player[],
    teamCount?: number,
    playerCount?: number
  ) => void
  clearTeams: () => void
}

const useTeamsStore = create<TeamsState>(set => ({
  teams: [],

  generateTeams: (players, teamCount = 2, playerCount = 11) => {
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

    // Determine the number of teams
    let numberOfTeams = 2
    if (teamCount && teamCount > 2) {
      numberOfTeams = Math.min(
        teamCount,
        Math.ceil(shuffledPlayers.length / playerCount)
      )
    } else if (shuffledPlayers.length > playerCount * 2) {
      numberOfTeams = Math.ceil(shuffledPlayers.length / playerCount)
    }

    // Ensure at least two teams are created
    numberOfTeams = Math.max(2, numberOfTeams)

    // Define possible colors for teams
    const colors = ['ORANGE', 'GREEN', 'BLUE'] // Orange, Green, Light Blue

    // Generate teams with random colors
    const teams: Team[] = Array.from({ length: numberOfTeams }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      players: [],
      color: colors[index % colors.length] as TeamColor,
    }))

    // Distribute players evenly among teams
    shuffledPlayers.forEach((player, index) => {
      teams[index % numberOfTeams].players.push(player)
    })

    set({ teams })
  },

  clearTeams: () => set({ teams: [] }),
}))

export default useTeamsStore
