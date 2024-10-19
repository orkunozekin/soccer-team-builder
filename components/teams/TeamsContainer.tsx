import useTeamsStore from '@/store/useTeamsStore'
import React from 'react'
import TeamCard from './TeamCard'

export default function TeamsContainer() {
  const { teams } = useTeamsStore()
  return (
    <>
      {teams.length > 0 ? (
        <section className="flex flex-col gap-2 pt-2">
          <h4 className="font-semibold">Teams</h4>
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </section>
      ) : null}
    </>
  )
}
