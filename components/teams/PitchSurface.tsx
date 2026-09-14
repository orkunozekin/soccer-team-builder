import { PitchMarkings } from './PitchMarkings'

/**
 * Pitch background: striped grass + white markings.
 */
export function PitchSurface() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border-2 shadow-xl"
      style={{
        borderColor: 'var(--pitch-border)',
      }}
    >
      <div
        className="absolute inset-0 opacity-95"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            var(--pitch-surface) 0px,
            var(--pitch-surface) 22px,
            var(--pitch-surface-alt) 22px,
            var(--pitch-surface-alt) 44px
          )`,
        }}
      />
      <div className="absolute inset-0">
        <PitchMarkings className="h-full w-full" />
      </div>
    </div>
  )
}
