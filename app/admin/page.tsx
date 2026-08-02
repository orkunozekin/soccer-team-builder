import { redirect } from 'next/navigation'

/** Admin entry redirects to Matches; section switching is via AdminNav. */
export default function AdminPage() {
  redirect('/admin/matches')
}
