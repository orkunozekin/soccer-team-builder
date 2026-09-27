import Link from 'next/link'

export default function ClubNotFound() {
  return (
    <div className="container mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Club not found
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        This club does not exist, or you do not have access.
      </p>
      <Link
        href="/matches"
        className="mt-6 inline-block text-sm font-semibold text-red-50 underline-offset-2 hover:underline"
      >
        Back to matches
      </Link>
    </div>
  )
}
