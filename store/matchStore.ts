'use client'

import { create } from 'zustand'
import { Match } from '@/types/match'
import { RSVP } from '@/types/rsvp'

interface MatchState {
  matches: Match[]
  currentMatch: Match | null
  matchRSVPs: RSVP[]
  loading: boolean
  setMatches: (matches: Match[]) => void
  setCurrentMatch: (match: Match | null) => void
  setMatchRSVPs: (rsvps: RSVP[]) => void
  setLoading: (loading: boolean) => void
  addMatch: (match: Match) => void
  updateMatch: (matchId: string, updates: Partial<Match>) => void
  removeMatch: (matchId: string) => void
  addRSVP: (rsvp: RSVP) => void
  updateRSVPPosition: (rsvpId: string, position: string | null) => void
  removeRSVP: (rsvpId: string) => void
}

export const useMatchStore = create<MatchState>(set => ({
  matches: [],
  currentMatch: null,
  matchRSVPs: [],
  loading: false,
  setMatches: matches => set({ matches }),
  setCurrentMatch: match => set({ currentMatch: match }),
  setMatchRSVPs: rsvps => set({ matchRSVPs: rsvps }),
  setLoading: loading => set({ loading }),
  addMatch: match => set(state => ({ matches: [...state.matches, match] })),
  updateMatch: (matchId, updates) =>
    set(state => ({
      matches: state.matches.map(m =>
        m.id === matchId ? { ...m, ...updates } : m
      ),
      currentMatch:
        state.currentMatch?.id === matchId
          ? { ...state.currentMatch, ...updates }
          : state.currentMatch,
    })),
  removeMatch: matchId =>
    set(state => ({
      matches: state.matches.filter(m => m.id !== matchId),
      currentMatch:
        state.currentMatch?.id === matchId ? null : state.currentMatch,
    })),
  addRSVP: rsvp => set(state => ({ matchRSVPs: [...state.matchRSVPs, rsvp] })),
  updateRSVPPosition: (rsvpId, position) =>
    set(state => ({
      matchRSVPs: state.matchRSVPs.map(r =>
        r.id === rsvpId ? { ...r, position, updatedAt: new Date() } : r
      ),
    })),
  removeRSVP: rsvpId =>
    set(state => ({
      matchRSVPs: state.matchRSVPs.filter(r => r.id !== rsvpId),
    })),
}))
