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

    // Determine the number of teams
    let numberOfTeams = 2
    if (teamSize && teamSize > 2) {
      numberOfTeams = Math.min(
        teamSize,
        Math.ceil(shuffledPlayers.length / playerCount)
      )
    } else if (shuffledPlayers.length > playerCount * 2) {
      numberOfTeams = Math.ceil(shuffledPlayers.length / playerCount)
    }

    // Ensure at least two teams are created
    numberOfTeams = Math.max(2, numberOfTeams)

    // Generate teams
    const teams: Team[] = Array.from({ length: numberOfTeams }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      players: [],
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
