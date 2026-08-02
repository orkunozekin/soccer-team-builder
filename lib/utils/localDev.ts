/** True in Next.js development builds or when using Firebase emulators. */
export function isLocalDev(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
  )
}
