# Context for Implementation

## Project Overview

Building a soccer pickup match team builder web application from scratch. The detailed implementation plan is in `IMPLEMENTATION_PLAN.md` - refer to it for all specifications.

## Key Decisions & Requirements

### Tech Stack

- **Next.js 14+ with App Router** (NOT Pages Router)
- **Firebase** (Authentication + Firestore)
- **Zustand** for state management
- **Tailwind CSS** for styling
- **shadcn/ui** components (Radix UI primitives)
- **TypeScript**

### Critical Requirements

1. **100% Responsive** - Must work perfectly on mobile, tablet, and desktop
2. **App Router** - Use `app/` directory structure, Server/Client Components appropriately
3. **No Reuse of Existing UI** - Build all new components from scratch (existing components in the project should not be reused)
4. **Mobile-First** - Design for mobile first, then enhance for larger screens

### Project Structure

- Use existing Next.js App Router structure (`app/` directory)
- All new components go in `components/` directory
- Services, utils, hooks in `lib/` directory
- Types in `types/` directory
- Zustand stores in `store/` directory

### Key Features to Build

1. Firebase Authentication (Email/Password)
2. User profiles with jersey number and position
3. Match management with RSVP system
4. Automated team generation (prioritize goalkeepers and admins)
5. Soccer pitch visualization for team rosters
6. Admin controls (match management, player transfers, RSVP poll controls)
7. RSVP scheduling (automatic: Mon/Wed 6am-8pm CT, Sun 6am-5pm CT)

### Important Notes

- Follow the Implementation Plan phases in order
- All components must be responsive
- Use `'use client'` directive for interactive components
- Use Route Handlers (`app/api/*/route.ts`) for API endpoints
- Soccer pitch must be fully responsive with mobile optimizations

## Starting Point

Begin with Phase 1: Project Setup & Authentication. Check `IMPLEMENTATION_PLAN.md` for detailed steps.
