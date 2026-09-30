import { redirect } from 'next/navigation'
import { clubMatchesPath } from '@/lib/utils/clubPaths'

/**
 * Bare `/c/[slug]` has no index UI — send callers to matches.
 * Auth and membership checks live on the matches page (login / 404).
 */
export default async function ClubIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug: rawSlug } = await params
  const slug = typeof rawSlug === 'string' ? rawSlug.trim() : ''
  if (!slug) {
    redirect('/matches')
  }
  redirect(clubMatchesPath(slug))
}
