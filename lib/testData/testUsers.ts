export type TestUserSeed = {
  email: string
  password: string
  displayName: string
  jerseyNumber: number
  position: string
}

// 22 deterministic test users for local/dev seeding.
// Keep password same to make testing easier.
export const TEST_USERS: TestUserSeed[] = [
  { email: 'alex.rivera@test.soccer', password: 'testpass123', displayName: 'Alex Rivera', jerseyNumber: 1, position: 'GK' },
  { email: 'jordan.lee@test.soccer', password: 'testpass123', displayName: 'Jordan Lee', jerseyNumber: 2, position: 'RB' },
  { email: 'sam.chen@test.soccer', password: 'testpass123', displayName: 'Sam Chen', jerseyNumber: 3, position: 'CB' },
  { email: 'riley.morgan@test.soccer', password: 'testpass123', displayName: 'Riley Morgan', jerseyNumber: 4, position: 'CB' },
  { email: 'casey.kim@test.soccer', password: 'testpass123', displayName: 'Casey Kim', jerseyNumber: 5, position: 'LB' },
  { email: 'quinn.taylor@test.soccer', password: 'testpass123', displayName: 'Quinn Taylor', jerseyNumber: 6, position: 'CDM' },
  { email: 'morgan.james@test.soccer', password: 'testpass123', displayName: 'Morgan James', jerseyNumber: 7, position: 'CM' },
  { email: 'drew.patel@test.soccer', password: 'testpass123', displayName: 'Drew Patel', jerseyNumber: 8, position: 'CM' },
  { email: 'jesse.wright@test.soccer', password: 'testpass123', displayName: 'Jesse Wright', jerseyNumber: 9, position: 'CAM' },
  { email: 'skyler.brooks@test.soccer', password: 'testpass123', displayName: 'Skyler Brooks', jerseyNumber: 10, position: 'RW' },

  { email: 'taylor.nguyen@test.soccer', password: 'testpass123', displayName: 'Taylor Nguyen', jerseyNumber: 11, position: 'LW' },
  { email: 'cameron.davis@test.soccer', password: 'testpass123', displayName: 'Cameron Davis', jerseyNumber: 12, position: 'ST' },
  { email: 'avery.wilson@test.soccer', password: 'testpass123', displayName: 'Avery Wilson', jerseyNumber: 13, position: 'CF' },
  { email: 'parker.thomas@test.soccer', password: 'testpass123', displayName: 'Parker Thomas', jerseyNumber: 14, position: 'RM' },
  { email: 'reese.martin@test.soccer', password: 'testpass123', displayName: 'Reese Martin', jerseyNumber: 15, position: 'LM' },
  { email: 'rowan.jackson@test.soccer', password: 'testpass123', displayName: 'Rowan Jackson', jerseyNumber: 16, position: 'RWB' },
  { email: 'logan.white@test.soccer', password: 'testpass123', displayName: 'Logan White', jerseyNumber: 17, position: 'LWB' },
  { email: 'hayden.harris@test.soccer', password: 'testpass123', displayName: 'Hayden Harris', jerseyNumber: 18, position: 'CM' },
  { email: 'finley.clark@test.soccer', password: 'testpass123', displayName: 'Finley Clark', jerseyNumber: 19, position: 'CDM' },
  { email: 'noah.ortiz@test.soccer', password: 'testpass123', displayName: 'Noah Ortiz', jerseyNumber: 20, position: 'RB' },
  { email: 'emerson.sanchez@test.soccer', password: 'testpass123', displayName: 'Emerson Sanchez', jerseyNumber: 21, position: 'LB' },
  { email: 'micah.bell@test.soccer', password: 'testpass123', displayName: 'Micah Bell', jerseyNumber: 22, position: 'ST' },
]

