import { getPitchPosition } from '@/lib/utils/pitchLayout'

export interface FormationPlayerInput {
  userId: string
  /** Current match/profile position code (e.g. ST, CM). */
  position: string | null | undefined
}

export interface FormationAssignment {
  userId: string
  fromPosition: string
  toPosition: string
}

function normalizePosition(position: string | null | undefined): string {
  if (!position) return 'CM'
  const upper = position.trim().toUpperCase()
  return upper || 'CM'
}

/** Euclidean distance between two position codes on the pitch coordinate map. */
export function positionDistance(
  from: string | null | undefined,
  to: string | null | undefined
): number {
  const a = getPitchPosition(normalizePosition(from))
  const b = getPitchPosition(normalizePosition(to))
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Minimum-cost bipartite assignment via bit DP.
 * `costs[row][col]` → returns `colByRow` (-1 if unmatched).
 * Requires max(n, m) ≤ 20.
 */
export function minCostAssignment(costs: number[][]): number[] {
  const n = costs.length
  if (n === 0) return []
  const m = costs[0]?.length ?? 0
  if (m === 0) return costs.map(() => -1)
  if (Math.max(n, m) > 20) {
    return greedyAssignment(costs)
  }

  if (n <= m) {
    // Assign every player a unique slot. DP over slot mask; player index = popcount.
    const size = 1 << m
    const dp = new Array<number>(size).fill(Infinity)
    const parent = new Array<number>(size).fill(-1)
    const parentSlot = new Array<number>(size).fill(-1)
    dp[0] = 0

    for (let mask = 0; mask < size; mask++) {
      if (dp[mask] === Infinity) continue
      const player = bitCount(mask)
      if (player >= n) continue
      for (let slot = 0; slot < m; slot++) {
        if (mask & (1 << slot)) continue
        const next = mask | (1 << slot)
        const cost = dp[mask] + costs[player]![slot]!
        if (cost < dp[next]) {
          dp[next] = cost
          parent[next] = mask
          parentSlot[next] = slot
        }
      }
    }

    let bestMask = -1
    let best = Infinity
    for (let mask = 0; mask < size; mask++) {
      if (bitCount(mask) !== n) continue
      if (dp[mask] < best) {
        best = dp[mask]
        bestMask = mask
      }
    }

    const assign = costs.map(() => -1)
    let mask = bestMask
    for (let player = n - 1; player >= 0 && mask > 0; player--) {
      const slot = parentSlot[mask]!
      assign[player] = slot
      mask = parent[mask]!
    }
    return assign
  }

  // More players than slots: fill every slot with a unique player.
  const size = 1 << n
  const dp = new Array<number>(size).fill(Infinity)
  const parent = new Array<number>(size).fill(-1)
  const parentPlayer = new Array<number>(size).fill(-1)
  dp[0] = 0

  for (let mask = 0; mask < size; mask++) {
    if (dp[mask] === Infinity) continue
    const slot = bitCount(mask)
    if (slot >= m) continue
    for (let player = 0; player < n; player++) {
      if (mask & (1 << player)) continue
      const next = mask | (1 << player)
      const cost = dp[mask] + costs[player]![slot]!
      if (cost < dp[next]) {
        dp[next] = cost
        parent[next] = mask
        parentPlayer[next] = player
      }
    }
  }

  let bestMask = -1
  let best = Infinity
  for (let mask = 0; mask < size; mask++) {
    if (bitCount(mask) !== m) continue
    if (dp[mask] < best) {
      best = dp[mask]
      bestMask = mask
    }
  }

  const assign = costs.map(() => -1)
  let mask = bestMask
  for (let slot = m - 1; slot >= 0 && mask > 0; slot--) {
    const player = parentPlayer[mask]!
    assign[player] = slot
    mask = parent[mask]!
  }
  return assign
}

function bitCount(x: number): number {
  let c = 0
  while (x) {
    x &= x - 1
    c++
  }
  return c
}

/** Fallback for oversized rosters: greedy nearest unique slot. */
function greedyAssignment(costs: number[][]): number[] {
  const n = costs.length
  const m = costs[0]?.length ?? 0
  const assign = costs.map(() => -1)
  const usedSlots = new Set<number>()
  const usedPlayers = new Set<number>()
  const pairs: { player: number; slot: number; cost: number }[] = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      pairs.push({ player: i, slot: j, cost: costs[i]![j]! })
    }
  }
  pairs.sort((a, b) => a.cost - b.cost || a.player - b.player || a.slot - b.slot)
  for (const p of pairs) {
    if (usedPlayers.has(p.player) || usedSlots.has(p.slot)) continue
    assign[p.player] = p.slot
    usedPlayers.add(p.player)
    usedSlots.add(p.slot)
    if (usedSlots.size >= m || usedPlayers.size >= n) break
  }
  return assign
}

function closestFormationSlot(
  position: string,
  formationSlots: readonly string[]
): string {
  let bestSlot = formationSlots[0] ?? 'CM'
  let bestDist = Infinity
  for (const slot of formationSlots) {
    const d = positionDistance(position, slot)
    if (d < bestDist) {
      bestDist = d
      bestSlot = slot
    }
  }
  return bestSlot
}

/**
 * Assign each player to the closest available formation slot.
 * When there are more players than slots, unmatched players take the
 * closest formation slot code (duplicates allowed).
 */
export function assignPlayersToFormation(
  players: FormationPlayerInput[],
  formationSlots: readonly string[]
): FormationAssignment[] {
  if (players.length === 0) return []
  if (formationSlots.length === 0) {
    return players.map(p => {
      const from = normalizePosition(p.position)
      return { userId: p.userId, fromPosition: from, toPosition: from }
    })
  }

  const costs = players.map(player =>
    formationSlots.map(slot => positionDistance(player.position, slot))
  )

  const slotByPlayer = minCostAssignment(costs)
  const results: FormationAssignment[] = []

  for (let i = 0; i < players.length; i++) {
    const slotIdx = slotByPlayer[i] ?? -1
    const from = normalizePosition(players[i]!.position)
    if (slotIdx >= 0) {
      results.push({
        userId: players[i]!.userId,
        fromPosition: from,
        toPosition: formationSlots[slotIdx]!,
      })
      continue
    }
    results.push({
      userId: players[i]!.userId,
      fromPosition: from,
      toPosition: closestFormationSlot(from, formationSlots),
    })
  }

  return results
}
