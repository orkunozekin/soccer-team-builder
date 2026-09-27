import { redirect } from 'next/navigation'

/** Admin entry. Match management lives on the club matches page. */
export default function AdminPage() {
  redirect('/admin/schedules')
}
