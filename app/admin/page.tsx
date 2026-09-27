import { redirect } from 'next/navigation'

/** Admin entry. Match lists live on the club Matches page. */
export default function AdminPage() {
  redirect('/admin/schedules')
}
