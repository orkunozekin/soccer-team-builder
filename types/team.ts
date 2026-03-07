export interface Team {
  id: string
  matchId: string
  teamNumber: number
  name: string
  color: string
  playerIds: string[]
  maxSize: number
  createdAt: Date
  updatedAt: Date
}

export interface TeamFirestore {
  id: string
  matchId: string
  teamNumber: number
  name: string
  color: string
  playerIds: string[]
  maxSize: number
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

export interface Bench {
  id: string
  matchId: string
  playerIds: string[]
  updatedAt: Date
}

export interface BenchFirestore {
  id: string
  matchId: string
  playerIds: string[]
  updatedAt: any // Firestore Timestamp
}
