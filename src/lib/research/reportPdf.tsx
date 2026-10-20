import fs from 'node:fs'
import path from 'node:path'
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { Research } from '@/payload-types'
import { formatDate } from '@/lib/formatDate'

export type ResearchDigest = {
  title: string
  month: string
  generatedAt: Date
  groups: { journal: string; articles: Research[] }[]
}
Font.register({
  family: 'ResearchNoto',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf') },
    {
      src: path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'),
      fontWeight: 700,
    },
  ],
})
const s = StyleSheet.create({
  page: {
    paddingTop: 85,
    paddingBottom: 58,
    paddingHorizontal: 48,
    fontFamily: 'ResearchNoto',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: '#203245',
  },
  logo: { position: 'absolute', top: 25, left: 48, width: 156, height: 30.3 },
  running: {
    position: 'absolute',
    top: 32,
    right: 48,
    width: 280,
    textAlign: 'right',
    fontSize: 8,
    color: '#607286',
  },
  footer: {
    position: 'absolute',
    top: 752,
    left: 48,
    width: 420,
    fontSize: 7.5,
    color: '#607286',
  },
  title: {
    fontSize: 26,
    lineHeight: 1.3,
    fontWeight: 700,
    color: '#285888',
    marginBottom: 12,
  },
  period: { fontSize: 14, lineHeight: 1.4, marginBottom: 12 },
  journal: {
    fontSize: 16,
    fontWeight: 700,
    color: '#285888',
    marginTop: 18,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cad7e4',
  },
  article: { fontSize: 12, fontWeight: 700, color: '#0e2a47', marginBottom: 5 },
  authors: { fontSize: 9, color: '#526174', marginBottom: 8 },
  paragraph: { marginBottom: 9 },
  date: { fontSize: 8, color: '#526174', marginTop: 6, marginBottom: 16 },
  link: { color: '#285888', textDecoration: 'none' },
  toc: { marginBottom: 4, fontSize: 9, lineHeight: 1.3 },
})
type Node = { text?: string; type?: string; children?: Node[] }
export function researchParagraphs(body: unknown): string[] {
  const root = (body as { root?: Node } | null)?.root
  const text = (node: Node): string =>
    node.text ??
    (node.children ?? []).map(text).join(node.type === 'list' ? '\n' : '')
  return (root?.children ?? []).map(text).filter((t) => t.trim())
}
export function researchDigestDocument(report: ResearchDigest) {
  const period = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(report.month + '-01T00:00:00Z'))
  const logo = {
    data: fs.readFileSync(path.join(process.cwd(), 'public/logo.png')),
    format: 'png' as const,
  }
  const chrome = (pageNumber?: number, totalPages?: number) => (
    <>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
      <Image src={logo} style={s.logo} />
      <Text style={s.running}>
        {report.title} | {period}
      </Text>
      <Text style={s.footer}>NICOTINE360 · Nicotine Resource Consortium</Text>
      <Text style={[s.footer, { left: 470, width: 94, textAlign: 'right' }]}>
        Page {pageNumber} of {totalPages}
      </Text>
    </>
  )
  return (
    <Document
      title={`${report.title} - ${period}`}
      author="Nicotine360"
      subject="Industry Research"
    >
      <Page
        size="LETTER"
        style={s.page}
        layout={({ children, pageNumber, totalPages }) => (
          <>
            {chrome(pageNumber, totalPages)}
            {children}
          </>
        )}
      >
        <View wrap={false} style={{ marginBottom: 10 }}>
          <Text style={s.title}>{report.title}</Text>
          <Text style={s.period}>{period}</Text>
        </View>
        <Text id="contents" style={s.journal}>
          Contents
        </Text>
        {report.groups.map((group, index) => (
          <View key={index}>
            <Text
              style={{ fontWeight: 700, marginTop: 9, marginBottom: 4, lineHeight: 1.3 }}
              minPresenceAhead={35}
            >
              <Link src={`#journal-${index}`} style={s.link}>
                {group.journal}
              </Link>
            </Text>
            {group.articles.map((article) => (
              <Text key={article.id} style={s.toc}>
                <Link src={`#research-${article.id}`} style={s.link}>
                  {article.title}
                </Link>
              </Text>
            ))}
          </View>
        ))}
      </Page>
      <Page
        size="LETTER"
        style={s.page}
        layout={({ children, pageNumber, totalPages }) => (
          <>
            {chrome(pageNumber, totalPages)}
            {children}
          </>
        )}
      >
        {report.groups.map((group, index) => (
          <View key={index}>
            <Text
              id={`journal-${index}`}
              style={s.journal}
              minPresenceAhead={90}
            >
              {group.journal}
            </Text>
            {group.articles.map((article) => (
              <View key={article.id}>
                <View wrap={false} minPresenceAhead={65}>
                  <Text id={`research-${article.id}`} style={s.article}>
                    {article.doiLink ? (
                      <Link src={article.doiLink} style={s.link}>
                        {article.title}
                      </Link>
                    ) : (
                      article.title
                    )}
                  </Text>
                  {article.authors && (
                    <Text style={s.authors}>{article.authors}</Text>
                  )}
                </View>
                {researchParagraphs(article.body).map((paragraph, i) => (
                  <Text key={i} style={s.paragraph} orphans={3} widows={3}>
                    {paragraph}
                  </Text>
                ))}
                {article.doiLink && (
                  <Text style={{ fontSize: 8 }}>
                    <Link src={article.doiLink} style={s.link}>
                      {article.doiLink}
                    </Link>
                  </Text>
                )}
                <Text style={s.date}>
                  Published: {formatDate(article.publishedDate)} ·{' '}
                  <Link src="#contents" style={s.link}>
                    Back to contents
                  </Link>
                </Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
export async function renderResearchDigest(
  report: ResearchDigest,
): Promise<Buffer> {
  return renderToBuffer(researchDigestDocument(report))
}
