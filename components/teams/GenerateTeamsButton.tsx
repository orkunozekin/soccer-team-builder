import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '../ui/label'
import { Player } from '@/interfaces/Player.interface'
import { useTeamsStore } from '@/store/useTeamsStore'

export default function GenerateTeamsButton() {
  const { generateTeams } = useTeamsStore()
  const { teams, players } = useTeamsStore()

  const [teamCount, setTeamCount] = useState<number | undefined>(2)

  const buttonLabel = teams.length > 0 ? 'Shuffle Teams' : 'Generate Teams'

  const teamPlayers = teams.reduce<Player[]>((acc, team) => {
    return [...acc, ...team.players]
  }, [])

  const handleGenerateTeams = () => {
    //when there are more players (All Players) than team players, use players for team generation
    const playersForTeamGeneration =
      players.length > teamPlayers.length ? players : teamPlayers
    generateTeams(playersForTeamGeneration, teamCount)
  }

  const playerCount = players.length
  const shouldDisplayButton = playerCount >= 4 || teamPlayers.length >= 4

  const handleSetTeamCount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0
    setTeamCount(value > 0 ? value : undefined)
  }

  return (
    <>
      {shouldDisplayButton ? (
        <section className="mt-2 flex items-end gap-2">
          <div className="flex w-1/2 flex-col gap-1">
            <Label className="font-semibold">minimum # of teams</Label>
            <Input
              placeholder="2"
              onChange={handleSetTeamCount}
              type="number"
            />
          </div>
          <Button onClick={handleGenerateTeams} className="w-1/2">
            {buttonLabel}
          </Button>
        </section>
      ) : null}
    </>
  )
}
