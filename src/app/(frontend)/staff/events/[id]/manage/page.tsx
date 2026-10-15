import { redirect } from 'next/navigation'

export default async function LegacyStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/events/${encodeURIComponent(id)}/manage`)
}
