/**
 * Standard soccer formations and their starting-XI slot lists.
 * Slot codes use {@link SOCCER_POSITIONS} values (duplicates allowed, e.g. two CB).
 */

export interface Formation {
  id: string
  label: string
  /** Ordered outfield shape including GK; length is typically 11. */
  slots: readonly string[]
}

export const FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2',
    label: '4-4-2',
    slots: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  },
  {
    id: '4-3-3',
    label: '4-3-3',
    slots: ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  },
  {
    id: '3-5-2',
    label: '3-5-2',
    slots: [
      'GK',
      'CB',
      'CB',
      'CB',
      'LM',
      'CDM',
      'CM',
      'CAM',
      'RM',
      'ST',
      'ST',
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      'GK',
      'LB',
      'CB',
      'CB',
      'RB',
      'CDM',
      'CDM',
      'LM',
      'CAM',
      'RM',
      'ST',
    ],
  },
  {
    id: '3-4-3',
    label: '3-4-3',
    slots: ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  },
  {
    id: '5-3-2',
    label: '5-3-2',
    slots: [
      'GK',
      'LWB',
      'CB',
      'CB',
      'CB',
      'RWB',
      'CM',
      'CM',
      'CM',
      'ST',
      'ST',
    ],
  },
  {
    id: '4-1-4-1',
    label: '4-1-4-1',
    slots: [
      'GK',
      'LB',
      'CB',
      'CB',
      'RB',
      'CDM',
      'LM',
      'CM',
      'CM',
      'RM',
      'ST',
    ],
  },
  {
    id: '4-5-1',
    label: '4-5-1',
    slots: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
  },
  {
    id: '5-4-1',
    label: '5-4-1',
    slots: [
      'GK',
      'LWB',
      'CB',
      'CB',
      'CB',
      'RWB',
      'LM',
      'CM',
      'CM',
      'RM',
      'ST',
    ],
  },
  {
    id: '3-4-2-1',
    label: '3-4-2-1',
    slots: [
      'GK',
      'CB',
      'CB',
      'CB',
      'LM',
      'CM',
      'CM',
      'RM',
      'CAM',
      'CAM',
      'ST',
    ],
  },
] as const

export const FORMATION_IDS = FORMATIONS.map(f => f.id)

export function getFormationById(id: string | null | undefined): Formation | null {
  if (!id) return null
  return FORMATIONS.find(f => f.id === id) ?? null
}

export function isFormationId(id: string): boolean {
  return FORMATIONS.some(f => f.id === id)
}
