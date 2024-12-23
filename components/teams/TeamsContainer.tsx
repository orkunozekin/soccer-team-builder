import { useTeamsStore } from '@/store/useTeamsStore'
import React from 'react'
import TeamCard from './TeamCard'
import TrashIcon from '@/components/icons/TrashIcon'
import { Button } from '../ui/button'

export default function TeamsContainer() {
  const { teams, removeTeam, clearTeams } = useTeamsStore()
  return (
    <>
      {teams.length > 0 ? (
        <section className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Teams</h4>
            <Button onClick={clearTeams} className="bg-black text-white">
              Clear teams
            </Button>
          </div>
          {teams.map(team => (
            <TeamCard team={team} key={team.id} />
            // <section
            //   className="flex items-center justify-between gap-1"
            //   key={team.id}
            // >
            //   <div className="rounded-md border border-neutral-50 px-2 py-4">
            //     <TrashIcon onClick={() => removeTeam(team.id)} className="" />
            //   </div>
            // </section>
          ))}
        </section>
      ) : null}
    </>
  )
}
