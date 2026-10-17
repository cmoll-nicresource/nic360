import Link from 'next/link'

export function LegislationNav({ active }: { active: 'bills' | 'itrac' }) {
  return (
    <nav className="legislation-nav" aria-label="Legislative section">
      <Link href="/bills" aria-current={active === 'bills' ? 'page' : undefined}>Bill library</Link>
      <Link href="/bills/itrac" aria-current={active === 'itrac' ? 'page' : undefined}>StateNet iTrac</Link>
    </nav>
  )
}
