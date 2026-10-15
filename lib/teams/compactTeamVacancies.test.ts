import { describe, expect, it } from 'vitest'
import {
  type VacancyPlayer,
  compactTeamVacancies,
} from './compactTeamVacancies'

function player(
  userId: string,
  time: number | null,
  position = 'ST'
): VacancyPlayer {
  return { userId, rsvpAt: time == null ? null : new Date(time), position }
}

describe('compactTeamVacancies', () => {
  it('cascades through four teams without sorting unaffected rosters', () => {
    const teams = [
      { teamNumber: 1, playerIds: ['b'] },
      { teamNumber: 2, playerIds: ['d', 'c'] },
      { teamNumber: 3, playerIds: ['f', 'e'] },
      { teamNumber: 4, playerIds: ['h', 'g'] },
    ]
    const result = compactTeamVacancies(
      teams,
      'bcdefgh'.split('').map((id, i) => player(id, i)),
      { capacities: new Map([1, 2, 3, 4].map(n => [n, 2])) }
    )
    expect(result.map(t => t.playerIds)).toEqual([
      ['b', 'c'],
      ['d', 'e'],
      ['f', 'g'],
      ['h'],
    ])
    expect(teams[1].playerIds).toEqual(['d', 'c'])
  })

  it('uses UID ties, unknown times last, and excludes stale or cancelled members', () => {
    const teams = [
      { teamNumber: 1, playerIds: ['cancelled'] },
      { teamNumber: 2, playerIds: ['missing', 'z', 'a', 'stale'] },
    ]
    const result = compactTeamVacancies(
      teams,
      [player('missing', null), player('z', 1), player('a', 1)],
      {
        capacities: new Map([
          [1, 2],
          [2, 2],
        ]),
      }
    )
    expect(result.map(t => t.playerIds)).toEqual([['a', 'z'], ['missing']])
  })

  it('keeps manual pins and avoids a second GK on Teams 1 and 2', () => {
    const result = compactTeamVacancies(
      [
        { teamNumber: 1, playerIds: ['gk1'] },
        { teamNumber: 2, playerIds: ['pin', 'gk2', 'outfield'] },
      ],
      [
        player('gk1', 1, 'GK'),
        player('pin', 2),
        player('gk2', 3, 'GK'),
        player('outfield', 4),
      ],
      {
        capacities: new Map([
          [1, 2],
          [2, 3],
        ]),
        manualAssignments: { pin: 2 },
      }
    )
    expect(result.map(t => t.playerIds)).toEqual([
      ['gk1', 'outfield'],
      ['pin', 'gk2'],
    ])
  })

  it('promotes a GK into an earlier team with no keeper using the existing priority exception', () => {
    expect(
      compactTeamVacancies(
        [
          { teamNumber: 1, playerIds: [] },
          { teamNumber: 2, playerIds: ['keeper'] },
        ],
        [player('keeper', 1, 'GK')]
      )[0].playerIds
    ).toEqual(['keeper'])
  })

  it('preserves partial rosters when filling only cancellation and donor vacancies', () => {
    const result = compactTeamVacancies(
      [
        { teamNumber: 1, playerIds: ['a', 'stale'] },
        { teamNumber: 2, playerIds: ['b', 'c'] },
        { teamNumber: 3, playerIds: ['d'] },
      ],
      ['abcd'.split('')].flat().map((id, i) => player(id, i)),
      {
        targets: new Map([
          [1, 2],
          [2, 2],
          [3, 1],
        ]),
      }
    )
    expect(result.map(t => t.playerIds)).toEqual([['a', 'b'], ['c', 'd'], []])
  })

  it('handles empty teams, no donors, missing times, and duplicate roster membership', () => {
    const result = compactTeamVacancies(
      [
        { teamNumber: 1, playerIds: [] },
        { teamNumber: 2, playerIds: ['a', 'a'] },
        { teamNumber: 3, playerIds: [] },
      ],
      [player('a', null)],
      { manualAssignments: { a: 2 } }
    )
    expect(result.map(t => t.playerIds)).toEqual([[], ['a'], []])
  })
})
