import { redirect } from 'next/navigation'

/** Match management lives on the club matches page. */
export default function AdminMatchesPage() {
  redirect('/matches')
}
