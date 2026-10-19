import Link from 'next/link'
import type { Research } from '@/payload-types'
import { formatDate } from '@/lib/formatDate'
export function ResearchRow({ article }: { article: Research }) {
  return (
    <Link href={`/research/${article.id}`} className="edition-news-row">
      <div className="edition-meta">
        <span>
          {typeof article.journal === 'object'
            ? article.journal?.name
            : 'Industry Research'}
        </span>
        {article.publishedDate && (
          <time dateTime={article.publishedDate}>
            {formatDate(article.publishedDate)}
          </time>
        )}
      </div>
      <h3>{article.title}</h3>
      {article.authors && <p className="edition-meta">{article.authors}</p>}
      <span className="edition-row-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  )
}
