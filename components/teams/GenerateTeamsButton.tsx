import React from 'react'
import { Button } from '../ui/button'
import useTeamsStore from '@/store/useTeamsStore'
import { usePlayersStore } from '@/store/usePlayerStore'

export default function GenerateTeamsButton() {
  const { generateTeams } = useTeamsStore()
  const { players } = usePlayersStore()
  const { teams } = useTeamsStore()

  const buttonLabel = teams.length > 0 ? 'Shuffle Teams' : 'Generate Teams'

  const handleGenerateTeams = () => {
    generateTeams(players, 5)
  }

  return <Button onClick={handleGenerateTeams}>{buttonLabel}</Button>
}
