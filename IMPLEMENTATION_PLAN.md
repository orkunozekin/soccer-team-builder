# Soccer Pickup Match Team Builder - Implementation Plan

## Overview

Build a web application for managing soccer pickup matches with user authentication, RSVP system, automated team generation, and admin controls. The app will use Next.js App Router, Firebase Authentication + Firestore, Zustand for state management, and Tailwind CSS.

**Note**: This plan uses the existing project structure with App Router. All new UI components will be built from scratch (existing UI components will not be reused).

**Critical Requirement**: The application must be **100% responsive** and fully functional on all device sizes (mobile phones, tablets, and desktops). All components, layouts, and interactions must be optimized for touch and mouse inputs.

## App Router Patterns

Since we're using Next.js App Router, follow these patterns:

- **Server Components by default**: Pages and layouts are Server Components unless marked with `'use client'`
- **Client Components**: Use `'use client'` directive for:
  - Components using hooks (useState, useEffect, Zustand)
  - Interactive components (forms, buttons with onClick)
  - Components using Firebase Auth (client-side)
- **Route Handlers**: Use `app/api/*/route.ts` for API endpoints instead of `pages/api/*`
- **Layouts**: Use `app/layout.tsx` for root layout, nested layouts for route groups
- **Loading & Error States**: Use `loading.tsx` and `error.tsx` files in route directories
- **Metadata**: Use metadata exports in page files for SEO

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Authentication & Database**: Firebase (Auth + Firestore)
- **Code Quality**: Prettier, ESLint
- **UI Components**: shadcn/ui (Radix UI primitives)

## Architecture Overview

### Data Models (Firestore Collections)

1. **users** collection

   - `uid` (document ID from Firebase Auth)
   - `email`: string
   - `displayName`: string
   - `jerseyNumber`: number | null
   - `position`: string | null (e.g., 'GK', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST', etc.)
   - `role`: 'user' | 'admin' | 'superAdmin'
   - `createdAt`: timestamp
   - `updatedAt`: timestamp

2. **matches** collection

   - `id`: string (document ID)
   - `date`: timestamp
   - `time`: string (HH:mm format)
   - `rsvpOpen`: boolean
   - `rsvpOpenAt`: timestamp | null (manual override)
   - `rsvpCloseAt`: timestamp | null (manual override)
   - `createdAt`: timestamp
   - `updatedAt`: timestamp

3. **rsvps** collection

   - `id`: string (document ID)
   - `matchId`: string (reference to matches)
   - `userId`: string (reference to users)
   - `status`: 'confirmed' | 'cancelled'
   - `rsvpAt`: timestamp
   - `updatedAt`: timestamp

4. **teams** collection (subcollection under matches)

   - `id`: string (document ID)
   - `matchId`: string (parent match)
   - `teamNumber`: number (1, 2, 3, etc.)
   - `name`: string
   - `color`: string
   - `playerIds`: string[] (array of user IDs)
   - `maxSize`: number (default: 11)
   - `createdAt`: timestamp
   - `updatedAt`: timestamp

5. **bench** collection (subcollection under matches)

   - `id`: string (document ID)
   - `matchId`: string (parent match)
   - `playerIds`: string[] (array of user IDs)
   - `updatedAt`: timestamp

## File Structure

```
soccer-team-builder/
├── app/
│   ├── layout.tsx               # Root layout, Firebase init, auth state
│   ├── page.tsx                 # Home/Landing page
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── register/
│   │   └── page.tsx            # Registration page
│   ├── matches/
│   │   ├── page.tsx            # Matches list page
│   │   └── [matchId]/
│   │       └── page.tsx        # Match details, teams, RSVP
│   ├── admin/
│   │   ├── page.tsx            # Admin dashboard
│   │   └── matches/
│   │       └── [matchId]/
│   │           └── page.tsx    # Admin match management
│   └── api/                     # API routes (Route Handlers)
│       ├── rsvp/
│       │   └── route.ts         # RSVP API endpoints
│       └── matches/
│           └── route.ts        # Match API endpoints
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── profile/
│   │   ├── PositionSelector.tsx
│   │   └── ProfileForm.tsx
│   ├── matches/
│   │   ├── MatchCard.tsx
│   │   ├── RSVPButton.tsx
│   │   └── MatchDetails.tsx
│   ├── teams/
│   │   ├── TeamCard.tsx
│   │   ├── TeamPlayerList.tsx
│   │   ├── BenchList.tsx
│   │   └── SoccerPitch.tsx        # Soccer pitch visualization with player positions
│   ├── admin/
│   │   ├── AdminMatchControls.tsx
│   │   ├── TeamManager.tsx
│   │   ├── PlayerTransfer.tsx
│   │   └── RSVPPollControls.tsx
│   └── ui/                      # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── lib/
│   ├── firebase/
│   │   ├── config.ts            # Firebase config
│   │   ├── auth.ts              # Auth helpers
│   │   └── firestore.ts         # Firestore helpers
│   ├── services/
│   │   ├── userService.ts       # User CRUD operations
│   │   ├── matchService.ts      # Match CRUD operations
│   │   ├── rsvpService.ts       # RSVP operations
│   │   └── teamService.ts       # Team generation & management
│   ├── utils/
│   │   ├── teamGenerator.ts     # Team generation algorithm
│   │   ├── rsvpScheduler.ts     # RSVP poll scheduling logic
│   │   ├── dateUtils.ts         # Date/time helpers
│   │   └── pitchLayout.ts       # Position mapping to pitch coordinates
│   ├── constants/
│   │   └── positions.ts         # Soccer position constants
│   └── hooks/
│       ├── useAuth.ts           # Auth hook
│       ├── useMatch.ts          # Match data hook
│       └── useAdmin.ts          # Admin permissions hook
├── store/
│   ├── authStore.ts             # Auth state (Zustand)
│   ├── matchStore.ts            # Match state (Zustand)
│   └── teamStore.ts             # Team state (Zustand)
├── types/
│   ├── user.ts
│   ├── match.ts
│   ├── rsvp.ts
│   └── team.ts
├── app/
│   └── globals.css              # Global styles + Tailwind (in app directory for App Router)
├── public/
│   └── ...
├── firebase.json                 # Firebase config (if using CLI)
├── .env.local                    # Environment variables
├── next.config.mjs             # Next.js config (or .js)
├── tailwind.config.ts          # Tailwind config (or .js)
├── tsconfig.json
├── package.json
└── README.md
```

## Implementation Steps

### Phase 1: Project Setup & Authentication

1. **Project Setup**

   - Use existing Next.js App Router project structure
   - Ensure Tailwind CSS is configured
   - Ensure Prettier and ESLint are set up
   - Install shadcn/ui components (if not already installed)
   - Archive or remove existing UI components (we're building new ones from scratch)
   - Install Firebase: `yarn add firebase`
   - Install date utilities: `yarn add date-fns date-fns-tz`

2. **Firebase Setup**

   - Create Firebase project
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Set up Firestore security rules
   - Configure Firebase in `lib/firebase/config.ts`
   - Add environment variables (`.env.local`)

3. **Authentication Implementation**

   - Create `lib/firebase/auth.ts` with auth helpers
   - Create `store/authStore.ts` for auth state
   - Create `lib/hooks/useAuth.ts` hook
   - Build login page (`app/login/page.tsx`) - Client Component
   - Build registration page (`app/register/page.tsx`) - Client Component
   - Create auth protection utilities for route protection
   - Update `app/layout.tsx` to initialize Firebase and handle auth state
   - Create middleware for protected routes (optional, or use client-side checks)

### Phase 2: User Management & Profile

4. **User Service & Types**

   - Define `types/user.ts` interface with `position: string | null`
   - Create `lib/constants/positions.ts` with available soccer positions array:
     ```typescript
     export const SOCCER_POSITIONS = [
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
       { value: 'ST', label: 'ST (Striker)' }
     ]
     ```

   - Create `lib/services/userService.ts` for Firestore operations
   - Create user profile page (optional, for editing jersey number/position)
   - Build position selector component using the constants (dropdown/select)
   - Add user creation on registration

5. **Admin Role System**

   - Add role checking utilities
   - Create `lib/hooks/useAdmin.ts` for admin permissions
   - Add admin route protection (client-side checks in components or middleware)
   - Create protected route wrapper component for admin pages

### Phase 3: Match Management

6. **Match Service & Types**

   - Define `types/match.ts` interface
   - Create `lib/services/matchService.ts`
   - Create `store/matchStore.ts` for match state
   - Build matches list page (`app/matches/page.tsx`) - Client Component with data fetching
   - Build match details page (`app/matches/[matchId]/page.tsx`) - Client Component

7. **RSVP System**

   - Define `types/rsvp.ts` interface
   - Create `lib/services/rsvpService.ts`
   - Build `components/matches/RSVPButton.tsx`
   - Implement RSVP creation/cancellation
   - Add RSVP status display

### Phase 4: RSVP Poll Scheduling

8. **Scheduling Logic**

   - Create `lib/utils/rsvpScheduler.ts`
   - Implement automatic schedule:
     - Monday/Wednesday: Open 6am CT, Close 8pm CT
     - Sunday: Open 6am CT, Close 5pm CT
   - Create Route Handler (`app/api/rsvp/schedule/route.ts`) or Cloud Function for scheduled opening/closing
   - Add manual override functionality for admins
   - Use client-side checks on page load to update RSVP status based on schedule

9. **RSVP Poll Controls (Admin)**

   - Build `components/admin/RSVPPollControls.tsx`
   - Add manual open/close functionality
   - Display current poll status

### Phase 5: Team Generation

10. **Team Generation Algorithm**

    - Create `lib/utils/teamGenerator.ts`
    - Implement helper function `isGoalkeeper()` to check if position string indicates goalkeeper (handles 'GK', 'Goalkeeper', case variations)
    - Implement team generation logic:
      - Prioritize goalkeepers to first two teams (max 1 per team) - check position string for GK indicators
      - Prioritize admins to first two teams
      - First come first serve for remaining players
      - Default max team size: 11 players
    - Create `lib/services/teamService.ts` for team operations
    - Define `types/team.ts` interface

11. **Team Display**

    - Build `components/teams/SoccerPitch.tsx`:
      - Create soccer field visualization (green field with white lines, center circle, penalty boxes, goals)
      - Map player positions to pitch coordinates using `lib/utils/pitchLayout.ts`
      - Display players as positioned elements on the pitch (showing jersey number, name, position)
      - **Responsive Layout**:
        - Desktop (≥1024px): Side-by-side pitch view (both teams visible simultaneously)
        - Tablet (768px-1023px): Stacked pitch view (teams stacked vertically, full width)
        - Mobile (<768px): Single pitch view with team toggle button/switcher
      - **Mobile Optimizations**:
        - Touch-friendly player badges (minimum 44x44px touch targets)
        - Simplified player info display (jersey number + abbreviated name)
        - Swipe gestures for team switching (optional enhancement)
        - Horizontal scroll option for wider pitch view if needed
        - Optimized font sizes for readability on small screens
      - Handle players without positions by placing them in appropriate areas
      - Ensure pitch scales proportionally on all screen sizes
    - Build `components/teams/TeamCard.tsx`
    - Build `components/teams/TeamPlayerList.tsx` (optional list view alternative to pitch)
    - Build `components/teams/BenchList.tsx` (display players not on the field)
    - Integrate team display in match details page with pitch visualization as primary view
    - Add toggle between pitch view and list view (optional)
    - Auto-generate teams as RSVPs come in (or on poll close)

### Phase 6: Admin Features

12. **Admin Match Management**

    - Create admin dashboard (`app/admin/page.tsx`) - Client Component
    - Build `components/admin/AdminMatchControls.tsx`:
      - Set match date/time
      - Open/close RSVP polls manually
    - Build `components/admin/TeamManager.tsx`:
      - View all teams and bench on soccer pitch visualization
      - Substitute players between teams/bench (drag-and-drop on pitch or dropdown)
      - Remove players from teams/bench
      - Update pitch display in real-time as players are moved

13. **Player Transfer Component**

    - Build `components/admin/PlayerTransfer.tsx`
    - Implement drag-and-drop or dropdown-based transfers
    - Add validation (max team size, goalkeeper limits)

### Phase 7: UI/UX Polish

14. **Styling & Components**

    - Style all pages with Tailwind CSS
    - **100% Responsive Design Requirements**:
      - Mobile-first approach using Tailwind breakpoints (sm, md, lg, xl, 2xl)
      - All navigation must be mobile-friendly (hamburger menu, collapsible sidebar)
      - Forms must be optimized for mobile input (proper input types, large touch targets)
      - Tables and lists must be scrollable or converted to cards on mobile
      - Modals and dialogs must be full-screen or bottom sheets on mobile
      - Touch targets minimum 44x44px for all interactive elements
      - Text must be readable without zooming (minimum 16px base font size)
      - Images and media must scale appropriately
      - No horizontal scrolling on any page (except intentional components like pitch)
    - Add loading states (responsive spinners/skeletons)
    - Add error handling and user feedback
    - Add toast notifications for actions (mobile-friendly positioning)

15. **Real-time Updates**

    - Implement Firestore real-time listeners for:
      - RSVP status changes
      - Team updates
      - Match status changes
    - Update Zustand stores with real-time data

## Key Algorithms

### Pitch Layout Utility (`lib/utils/pitchLayout.ts`)

```typescript
// Position to pitch coordinates mapping
// Coordinates are relative (0-100%) for responsive design
interface PitchPosition {
  x: number  // 0-100, left to right
  y: number  // 0-100, top to bottom
}

const POSITION_COORDINATES: Record<string, PitchPosition> = {
  // Goalkeeper
  'GK': { x: 50, y: 5 },
  
  // Defenders
  'LB': { x: 15, y: 25 },
  'LWB': { x: 10, y: 30 },
  'CB': { x: 50, y: 20 },
  'RWB': { x: 90, y: 30 },
  'RB': { x: 85, y: 25 },
  
  // Midfielders
  'CDM': { x: 50, y: 40 },
  'LM': { x: 20, y: 50 },
  'CM': { x: 50, y: 50 },
  'CAM': { x: 50, y: 60 },
  'RM': { x: 80, y: 50 },
  
  // Forwards
  'LW': { x: 25, y: 75 },
  'CF': { x: 50, y: 80 },
  'ST': { x: 50, y: 85 },
  'RW': { x: 75, y: 75 },
}

function getPitchPosition(position: string | null): PitchPosition {
  if (!position) return { x: 50, y: 50 } // Default center
  return POSITION_COORDINATES[position.toUpperCase()] || { x: 50, y: 50 }
}

// For multiple players in same position, offset them slightly
function getOffsetPosition(basePosition: PitchPosition, index: number, total: number): PitchPosition {
  const offsetX = (index - (total - 1) / 2) * 8 // Spread horizontally
  return {
    x: Math.max(5, Math.min(95, basePosition.x + offsetX)),
    y: basePosition.y
  }
}
```

### Team Generation Algorithm (`lib/utils/teamGenerator.ts`)

```typescript
// Helper function to check if position is goalkeeper
function isGoalkeeper(position: string | null): boolean {
  if (!position) return false
  const gkPositions = ['GK', 'Goalkeeper', 'goalkeeper', 'gk']
  return gkPositions.includes(position.toUpperCase()) || 
         position.toLowerCase().includes('goalkeeper')
}

function generateTeams(rsvps: RSVP[], users: User[], maxTeamSize = 11) {
  // 1. Separate players by priority
  const goalkeepers = rsvps.filter(r => {
    const user = users.find(u => u.uid === r.userId)
    return user && isGoalkeeper(user.position)
  })
  const admins = rsvps.filter(r => {
    const user = users.find(u => u.uid === r.userId)
    return user && ['admin', 'superAdmin'].includes(user.role)
  })
  const regularPlayers = rsvps.filter(r => 
    !goalkeepers.includes(r) && !admins.includes(r)
  )
  
  // 2. Create teams (at least 2)
  const teamCount = Math.max(2, Math.ceil(rsvps.length / maxTeamSize))
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    teamNumber: i + 1,
    playerIds: []
  }))
  
  // 3. Assign goalkeepers to first two teams (max 1 per team)
  goalkeepers.forEach((gk, idx) => {
    if (idx < 2) teams[idx].playerIds.push(gk.userId)
  })
  
  // 4. Assign admins to first two teams
  admins.forEach((admin, idx) => {
    const teamIdx = idx % 2
    if (teams[teamIdx].playerIds.length < maxTeamSize) {
      teams[teamIdx].playerIds.push(admin.userId)
    }
  })
  
  // 5. Fill remaining spots first come first serve
  regularPlayers.forEach(player => {
    // Find team with most space
    const team = teams.reduce((min, t) => 
      t.playerIds.length < min.playerIds.length ? t : min
    )
    if (team.playerIds.length < maxTeamSize) {
      team.playerIds.push(player.userId)
    }
  })
  
  return teams
}
```

### RSVP Scheduler (`lib/utils/rsvpScheduler.ts`)

```typescript
function getRSVPSchedule(date: Date): { openAt: Date, closeAt: Date } {
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
  const openAt = new Date(date)
  const closeAt = new Date(date)
  
  if (dayOfWeek === 1 || dayOfWeek === 3) { // Monday or Wednesday
    openAt.setHours(6, 0, 0, 0)  // 6am CT
    closeAt.setHours(20, 0, 0, 0) // 8pm CT
  } else if (dayOfWeek === 0) { // Sunday
    openAt.setHours(6, 0, 0, 0)  // 6am CT
    closeAt.setHours(17, 0, 0, 0) // 5pm CT
  }
  
  return { openAt, closeAt }
}
```

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data, admins can read all
    match /users/{userId} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superAdmin']);
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Matches: all authenticated users can read, only admins can write
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superAdmin'];
      
      // RSVPs: users can create/update their own, admins can manage all
      match /rsvps/{rsvpId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
        allow update, delete: if request.auth != null && 
          (request.resource.data.userId == request.auth.uid ||
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superAdmin']);
      }
      
      // Teams: all can read, only admins can write
      match /teams/{teamId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superAdmin'];
      }
    }
  }
}
```

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Dependencies to Install

**Note**: The project already has most dependencies. Additional dependencies needed:

```json
{
  "dependencies": {
    "firebase": "^10.0.0",
    "date-fns": "^2.30.0",
    "date-fns-tz": "^2.0.0"
  }
}
```

**Existing dependencies** (already in project):
- next, react, react-dom
- zustand
- tailwindcss, postcss, autoprefixer
- typescript
- eslint, prettier
- shadcn/ui components (Radix UI primitives)

## Soccer Positions Reference

Available positions for user selection in the UI (defined in `lib/constants/positions.ts`):

- **Goalkeeper**: GK
- **Defenders**: LB (Left Back), RB (Right Back), CB (Center Back), LWB (Left Wing Back), RWB (Right Wing Back)
- **Midfielders**: CDM (Central Defensive Midfielder), CM (Central Midfielder), CAM (Central Attacking Midfielder), LM (Left Midfielder), RM (Right Midfielder)
- **Forwards**: LW (Left Winger), RW (Right Winger), CF (Center Forward), ST (Striker)

The position field is stored as a string in Firestore, allowing flexibility for future additions or custom positions. The team generation algorithm uses a helper function `isGoalkeeper()` to identify goalkeeper positions by checking if the position string contains 'GK' or 'Goalkeeper' (case-insensitive).

## UI/UX Features

### Soccer Pitch Visualization

The primary team display will show rosters on a soccer pitch visualization:

- **Visual Design**:
  - Green field background with white field markings (center line, center circle, penalty boxes, goal areas)
  - Two halves of the pitch side-by-side for Team 1 and Team 2
  - Players displayed as positioned elements with jersey number, name, and position badge
  - Color-coded by team (using team colors)
  - Bench area displayed below or beside the pitch

- **Position Mapping**:
  - Players are positioned on the pitch based on their position attribute
  - Goalkeepers at the goal area
  - Defenders in defensive third
  - Midfielders in middle third
  - Forwards in attacking third
  - Players without positions default to center positions
  - Multiple players in same position are offset horizontally

- **Interactivity** (Admin only):
  - Drag-and-drop players between positions on the pitch
  - Click players to transfer between teams or bench
  - Visual feedback during transfers

- **Responsive Design** (100% responsive requirement):
  - **Desktop (≥1024px)**:
    - Side-by-side pitch view (both teams visible)
    - Full player information displayed
    - Hover interactions for player details
    - Drag-and-drop enabled for admin
  - **Tablet (768px-1023px)**:
    - Stacked pitch view (teams vertically stacked)
    - Full width pitch for better visibility
    - Touch-optimized interactions
    - Simplified but complete player information
  - **Mobile (<768px)**:
    - Single pitch view with team toggle button/switcher
    - Touch-friendly player badges (44x44px minimum)
    - Swipe gestures for team switching (optional)
    - Abbreviated player names if needed
    - Bottom sheet or full-screen modals for player details
    - Optimized font sizes and spacing
    - Horizontal scroll option for pitch if needed

## Responsive Design Requirements

The application must be **100% responsive** across all components and pages:

### Breakpoints (Tailwind CSS)
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1023px (sm to lg)
- **Desktop**: ≥ 1024px (lg and above)

### Mobile-First Considerations

1. **Navigation**:
   - Mobile: Hamburger menu, bottom navigation, or collapsible sidebar
   - Desktop: Horizontal navigation bar or sidebar

2. **Forms**:
   - Large input fields (minimum 44px height)
   - Proper input types for mobile keyboards (email, tel, number)
   - Full-width inputs on mobile
   - Accessible labels and error messages

3. **Tables & Lists**:
   - Mobile: Convert to card-based layouts or horizontally scrollable
   - Desktop: Full table view

4. **Modals & Dialogs**:
   - Mobile: Full-screen or bottom sheet style
   - Desktop: Centered modal with backdrop

5. **Touch Interactions**:
   - All buttons minimum 44x44px
   - Adequate spacing between interactive elements
   - Touch-friendly dropdowns and selects
   - Swipe gestures where appropriate

6. **Typography**:
   - Base font size minimum 16px (prevents iOS zoom)
   - Responsive heading sizes
   - Readable line heights and spacing

7. **Images & Media**:
   - Responsive images with proper srcset
   - Aspect ratio preservation
   - Lazy loading for performance

8. **Soccer Pitch Component**:
   - Responsive scaling using percentage-based coordinates
   - Touch-optimized player interactions
   - Team toggle for mobile view
   - Horizontal scroll option if needed

## Testing Considerations

- Test team generation with various player counts
- Test RSVP scheduling logic
- Test admin permissions
- Test real-time updates
- Test edge cases (no goalkeepers, too many players, etc.)
- Test goalkeeper detection with various position string formats (GK, Goalkeeper, goalkeeper, etc.)
- Test pitch visualization with various formations and player counts
- **Responsive Design Testing**:
  - Test on actual devices (iOS, Android) and emulators
  - Test all breakpoints (mobile, tablet, desktop)
  - Test landscape and portrait orientations
  - Test touch interactions vs mouse interactions
  - Test form inputs on mobile keyboards
  - Test navigation on all screen sizes
  - Test modals and dialogs on mobile
  - Test pitch visualization on all screen sizes
  - Verify no horizontal scrolling (except intentional)
  - Verify all touch targets are accessible
  - Test with different font size preferences
- Test position mapping accuracy for all position types

## Deployment

- Deploy to Vercel (recommended for Next.js)
- Configure Firebase hosting (optional)
- Set up environment variables in deployment platform
- Configure Firestore security rules
- Set up Firebase Cloud Functions for scheduled RSVP poll management (optional)
