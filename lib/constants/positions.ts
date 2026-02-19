export interface SoccerPosition {
  value: string
  label: string
}

export const SOCCER_POSITIONS: SoccerPosition[] = [
  { value: 'GK', label: 'GK (Goalkeeper)' },
  { value: 'LB', label: 'LB (Left Back)' },
  { value: 'RB', label: 'RB (Right Back)' },
  { value: 'CB', label: 'CB (Center Back)' },
  { value: 'LWB', label: 'LWB (Left Wing Back)' },
  { value: 'RWB', label: 'RWB (Right Wing Back)' },
  { value: 'CDM', label: 'CDM (Central Defensive Midfielder)' },
  { value: 'CM', label: 'CM (Central Midfielder)' },
  { value: 'CAM', label: 'CAM (Central Attacking Midfielder)' },
  { value: 'LM', label: 'LM (Left Midfielder)' },
  { value: 'RM', label: 'RM (Right Midfielder)' },
  { value: 'LW', label: 'LW (Left Winger)' },
  { value: 'RW', label: 'RW (Right Winger)' },
  { value: 'CF', label: 'CF (Center Forward)' },
  { value: 'ST', label: 'ST (Striker)' },
]
