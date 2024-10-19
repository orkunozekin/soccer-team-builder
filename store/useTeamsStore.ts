import { Player } from '@/interfaces/Player.interface'
import { Team } from '@/interfaces/Team.interface'
import { create } from 'zustand'

interface TeamsState {
  teams: Team[]
  generateTeams: (players: Player[], teamSize: number) => void
  clearTeams: () => void
}

const useTeamsStore = create<TeamsState>(set => ({
  teams: [],

  generateTeams: (players, teamSize = 2, playerCount = 11) => {
    // Shuffle players using Fisher-Yates algorithm
    const shuffledPlayers = [...players]
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffledPlayers[i], shuffledPlayers[j]] = [
        shuffledPlayers[j],
        shuffledPlayers[i],
      ]
    }

    // Adjust the number of teams and player count if there are fewer players available
    teamSize = Math.min(
      teamSize,
      Math.ceil(shuffledPlayers.length / playerCount)
    )
    playerCount = Math.min(
      playerCount,
      Math.ceil(shuffledPlayers.length / teamSize)
    )

    // Generate teams
    const teams: Team[] = Array.from({ length: teamSize }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      players: [],
    }))

    // Distribute players evenly among teams
    shuffledPlayers.forEach((player, index) => {
      teams[index % teamSize].players.push(player)
    })

    set({ teams })
  },
  clearTeams: () => set({ teams: [] }),
}))

export default useTeamsStore
