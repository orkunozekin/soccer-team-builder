/**
 * Premier League–style pitch markings (SVG).
 * Center line, center circle, penalty areas + arcs, goal areas, corner arcs.
 * Dimensions: FIFA standard 105m × 68m.
 */
export function PitchMarkings({ className }: { className?: string }) {
  const W = 105
  const H = 68
  const cx = W / 2
  const cy = H / 2
  const penDepth = 16.5
  const penWidth = 40.32
  const goalWidth = 18.32
  const goalDepth = 5.5
  const circleR = 9.15
  const arcR = 9.15
  const cornerR = 1
  const lineWidth = 0.4

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <line
        x1={0}
        y1={cy}
        x2={W}
        y2={cy}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={circleR}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <rect
        x={(W - penWidth) / 2}
        y={0}
        width={penWidth}
        height={penDepth}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <rect
        x={(W - goalWidth) / 2}
        y={0}
        width={goalWidth}
        height={goalDepth}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M ${cx - arcR} ${penDepth} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${penDepth}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <rect
        x={(W - penWidth) / 2}
        y={H - penDepth}
        width={penWidth}
        height={penDepth}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <rect
        x={(W - goalWidth) / 2}
        y={H - goalDepth}
        width={goalWidth}
        height={goalDepth}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M ${cx - arcR} ${H - penDepth} A ${arcR} ${arcR} 0 0 0 ${cx + arcR} ${H - penDepth}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M ${cornerR} 0 Q 0 0 0 ${cornerR}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M ${W - cornerR} 0 Q ${W} 0 ${W} ${cornerR}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M 0 ${H - cornerR} Q 0 ${H} ${cornerR} ${H}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
      <path
        d={`M ${W - cornerR} ${H} Q ${W} ${H} ${W} ${H - cornerR}`}
        stroke="white"
        strokeWidth={lineWidth}
        fill="none"
      />
    </svg>
  )
}
