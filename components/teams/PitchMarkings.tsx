/**
 * FIFA/IFAB Law 1 pitch markings (SVG), oriented vertically (goals top & bottom).
 *
 * Standard international pitch: 105 m × 68 m (length × width).
 * ViewBox is width × length so x = touchline axis, y = goal-to-goal axis.
 *
 * Stroke color comes from --pitch-markings CSS variable.
 */
export function PitchMarkings({ className }: { className?: string }) {
  // Vertical pitch: x across (68 m), y along (105 m)
  const WIDTH = 68
  const LENGTH = 105
  const cx = WIDTH / 2

  // IFAB Law 1 distances (metres)
  const GOAL_INNER = 7.32
  const PENALTY_DEPTH = 16.5
  const GOAL_AREA_DEPTH = 5.5
  // Penalty / goal area width = goal + 2 × offset from each post
  const PENALTY_WIDTH = GOAL_INNER + 2 * PENALTY_DEPTH // 40.32
  const GOAL_AREA_WIDTH = GOAL_INNER + 2 * GOAL_AREA_DEPTH // 18.32
  const PENALTY_MARK = 11
  const CIRCLE_R = 9.15
  const CORNER_R = 1
  const CENTER_MARK_R = 0.35
  const PENALTY_SPOT_R = 0.3
  const LINE = 0.35
  const stroke = 'var(--pitch-markings)'

  // Chord half-width where the 9.15 m arc meets the 16.5 m penalty line
  // (distance from mark to line = 5.5 m)
  const arcChordHalf = Math.sqrt(CIRCLE_R ** 2 - (PENALTY_DEPTH - PENALTY_MARK) ** 2)

  const penX = (WIDTH - PENALTY_WIDTH) / 2
  const goalAreaX = (WIDTH - GOAL_AREA_WIDTH) / 2

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${LENGTH}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {/* Outer boundary */}
      <rect
        x={0}
        y={0}
        width={WIDTH}
        height={LENGTH}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />

      {/* Halfway line */}
      <line
        x1={0}
        y1={LENGTH / 2}
        x2={WIDTH}
        y2={LENGTH / 2}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />

      {/* Centre circle + mark */}
      <circle
        cx={cx}
        cy={LENGTH / 2}
        r={CIRCLE_R}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <circle
        cx={cx}
        cy={LENGTH / 2}
        r={CENTER_MARK_R}
        fill={stroke}
        stroke="none"
      />

      {/* --- Top goal (y = 0) --- */}
      <rect
        x={penX}
        y={0}
        width={PENALTY_WIDTH}
        height={PENALTY_DEPTH}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <rect
        x={goalAreaX}
        y={0}
        width={GOAL_AREA_WIDTH}
        height={GOAL_AREA_DEPTH}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <circle
        cx={cx}
        cy={PENALTY_MARK}
        r={PENALTY_SPOT_R}
        fill={stroke}
        stroke="none"
      />
      <path
        d={`M ${cx - arcChordHalf} ${PENALTY_DEPTH} A ${CIRCLE_R} ${CIRCLE_R} 0 0 1 ${cx + arcChordHalf} ${PENALTY_DEPTH}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />

      {/* --- Bottom goal (y = LENGTH) --- */}
      <rect
        x={penX}
        y={LENGTH - PENALTY_DEPTH}
        width={PENALTY_WIDTH}
        height={PENALTY_DEPTH}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <rect
        x={goalAreaX}
        y={LENGTH - GOAL_AREA_DEPTH}
        width={GOAL_AREA_WIDTH}
        height={GOAL_AREA_DEPTH}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <circle
        cx={cx}
        cy={LENGTH - PENALTY_MARK}
        r={PENALTY_SPOT_R}
        fill={stroke}
        stroke="none"
      />
      <path
        d={`M ${cx - arcChordHalf} ${LENGTH - PENALTY_DEPTH} A ${CIRCLE_R} ${CIRCLE_R} 0 0 0 ${cx + arcChordHalf} ${LENGTH - PENALTY_DEPTH}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />

      {/* Corner arcs (1 m quarter-circles) */}
      <path
        d={`M ${CORNER_R} 0 A ${CORNER_R} ${CORNER_R} 0 0 1 0 ${CORNER_R}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <path
        d={`M ${WIDTH - CORNER_R} 0 A ${CORNER_R} ${CORNER_R} 0 0 0 ${WIDTH} ${CORNER_R}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <path
        d={`M 0 ${LENGTH - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 0 ${CORNER_R} ${LENGTH}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />
      <path
        d={`M ${WIDTH} ${LENGTH - CORNER_R} A ${CORNER_R} ${CORNER_R} 0 0 1 ${WIDTH - CORNER_R} ${LENGTH}`}
        stroke={stroke}
        strokeWidth={LINE}
        fill="none"
      />

      {/* Goal mouths (7.32 m) — slightly thicker on the goal line */}
      <line
        x1={cx - GOAL_INNER / 2}
        y1={0}
        x2={cx + GOAL_INNER / 2}
        y2={0}
        stroke={stroke}
        strokeWidth={LINE * 1.8}
      />
      <line
        x1={cx - GOAL_INNER / 2}
        y1={LENGTH}
        x2={cx + GOAL_INNER / 2}
        y2={LENGTH}
        stroke={stroke}
        strokeWidth={LINE * 1.8}
      />
    </svg>
  )
}
