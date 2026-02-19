import { PitchMarkings } from './PitchMarkings'

/**
 * Pitch background: striped grass + white markings.
 * No players; use inside a wrapper that adds player markers.
 */
export function PitchSurface() {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg border-2 border-white shadow-xl">
      <div
        className="absolute inset-0 opacity-95"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            #2d6a2d 0px,
            #2d6a2d 20px,
            #276027 20px,
            #276027 40px
          )`,
        }}
      />
      <div className="absolute inset-0">
        <PitchMarkings className="h-full w-full" />
      </div>
    </div>
  )
}
