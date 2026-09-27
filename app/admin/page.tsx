import { redirect } from 'next/navigation'

/** Admin entry. Club match lists stay on the club page; all-clubs is /admin/matches. */
export default function AdminPage() {
  redirect('/admin/schedules')
}
