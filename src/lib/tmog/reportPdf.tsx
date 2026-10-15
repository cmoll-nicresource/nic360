import fs from 'node:fs'
import path from 'node:path'
import type { ComponentProps, ReactElement } from 'react'
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { Trademark } from '@/payload-types'

export type ReportMark = Trademark & { reportImage?: Buffer }
export type TrademarkReport = {
  kind: 'weekly' | 'monthly'
  title: string
  period: string
  generatedAt: Date
  sections: {
    title: string
    marks: ReportMark[]
    dateField: 'publishedDate' | 'cancelledDate' | 'renewedDate'
  }[]
}

const blue = '#285888'
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf') },
    { src: path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'), fontWeight: 700 },
  ],
})
const styles = StyleSheet.create({
  page: {
    paddingTop: 86,
    paddingBottom: 55,
    paddingHorizontal: 48,
    fontFamily: 'Noto Sans',
    fontSize: 9,
    color: '#203245',
    lineHeight: 1.45,
  },
  logo: { position: 'absolute', top: 25, left: 48, width: 156, height: 30.3 },
  running: {
    position: 'absolute',
    top: 34,
    right: 48,
    width: 260,
    textAlign: 'right',
    fontSize: 8,
    lineHeight: 1.2,
    color: '#607286',
  },
  footer: {
    position: 'absolute',
    top: 752,
    left: 48,
    width: 420,
    fontSize: 7,
    lineHeight: 1.2,
    color: '#607286',
  },
  eyebrow: { fontSize: 8, letterSpacing: 1.5, color: blue, marginBottom: 7 },
  title: { fontSize: 26, fontWeight: 700, lineHeight: 1.15, color: blue, marginBottom: 9 },
  period: { fontSize: 14, marginBottom: 7 },
  muted: { color: '#607286', fontSize: 8 },
  intro: { backgroundColor: '#edf3f8', padding: 13, marginTop: 15, marginBottom: 18 },
  section: {
    fontSize: 15,
    color: blue,
    fontWeight: 700,
    marginTop: 15,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#abc2d7',
  },
  mark: {
    marginBottom: 17,
    borderBottomWidth: 0.5,
    borderBottomColor: '#d8e2ec',
    paddingBottom: 12,
  },
  heading: { flexDirection: 'row', marginBottom: 8 },
  artwork: { width: 78, height: 62, objectFit: 'contain', marginRight: 14 },
  name: { fontSize: 14, fontWeight: 700, color: blue, marginBottom: 4 },
  fact: { fontSize: 8.5, marginBottom: 2 },
  label: { fontWeight: 700 },
  goods: { fontSize: 9, marginTop: 4 },
  link: { fontSize: 8, color: blue, marginTop: 5 },
})

export function reportDate(value?: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function trademarkReportDocument(
  report: TrademarkReport,
): ReactElement<ComponentProps<typeof Document>> {
  const logo = {
    data: fs.readFileSync(path.join(process.cwd(), 'public/logo.png')),
    format: 'png' as const,
  }
  const total = report.sections.reduce((sum, section) => sum + section.marks.length, 0)
  return (
    <Document
      title={`${report.title} - ${report.period}`}
      author="Nicotine360"
      subject="US trademark activity"
    >
      <Page
        size="LETTER"
        style={styles.page}
        layout={({ children, pageNumber, totalPages }) => (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive */}
            <Image src={logo} style={styles.logo} />
            <Text style={styles.running}>{report.period} | US TRADEMARKS</Text>
            <Text style={styles.footer}>NICOTINE360 | Source: USPTO | US trademark tracking</Text>
            <Text style={[styles.footer, { left: 470, width: 94, textAlign: 'right' }]}>
              Page {pageNumber} of {totalPages}
            </Text>
            {children}
          </>
        )}
      >
        <View wrap={false}>
          <Text style={styles.eyebrow}>TRADEMARK INTELLIGENCE</Text>
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.period}>{report.period}</Text>
          <Text style={styles.muted}>Generated {reportDate(report.generatedAt.toISOString())}</Text>
          <View style={styles.intro}>
            <Text>
              {report.kind === 'weekly'
                ? `${total} mark${total === 1 ? '' : 's'} published for opposition during this reporting week.`
                : report.sections
                    .map((section) => `${section.marks.length} ${section.title.toLowerCase()}`)
                    .join(' | ')}
            </Text>
            <Text style={[styles.muted, { marginTop: 5 }]}>
              US trademark records tracked by Nicotine360. Mark images are shown where available.
              Follow each record link for current status and filing documents.
            </Text>
          </View>
        </View>
        {report.sections.map((section, index) => (
          <View key={section.title}>
            <Text id={`section-${index}`} style={styles.section} minPresenceAhead={120}>
              {section.title} ({section.marks.length})
            </Text>
            {section.marks.length === 0 && (
              <Text>No {section.title.toLowerCase()} recorded for this period.</Text>
            )}
            {section.marks.map((mark, i) => (
              <View key={`${mark.id}-${i}`} style={styles.mark}>
                <View wrap={false} minPresenceAhead={40} style={styles.heading}>
                  {mark.reportImage && (
                    // eslint-disable-next-line jsx-a11y/alt-text -- PDF primitive
                    <Image src={{ data: mark.reportImage, format: 'png' }} style={styles.artwork} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{mark.title}</Text>
                    <Text style={styles.fact}>
                      <Text style={styles.label}>Serial: </Text>
                      {mark.serialNumber || 'Not recorded'}
                      {mark.registrationNumber
                        ? `   |   Registration: ${mark.registrationNumber}`
                        : ''}
                    </Text>
                    <Text style={styles.fact}>
                      <Text style={styles.label}>Owner: </Text>
                      {(section.dateField === 'renewedDate' && mark.renewal?.owner) ||
                        mark.owner ||
                        'Not recorded'}
                    </Text>
                    {(mark.ownerAddress ||
                      (section.dateField === 'renewedDate' && mark.renewal?.address)) && (
                      <Text style={styles.fact}>
                        {section.dateField === 'renewedDate'
                          ? mark.renewal?.address || mark.ownerAddress
                          : mark.ownerAddress}
                      </Text>
                    )}
                    <Text style={styles.fact}>
                      <Text style={styles.label}>
                        {section.dateField === 'publishedDate'
                          ? 'Published for opposition'
                          : section.dateField === 'renewedDate'
                            ? 'Renewed'
                            : 'Cancelled'}
                        :{' '}
                      </Text>
                      {reportDate(mark[section.dateField]) || 'Not recorded'}
                    </Text>
                    {mark.filedDate && (
                      <Text style={styles.fact}>Filed: {reportDate(mark.filedDate)}</Text>
                    )}
                    {mark.registeredDate && (
                      <Text style={styles.fact}>Registered: {reportDate(mark.registeredDate)}</Text>
                    )}
                  </View>
                </View>
                {mark.goods && (
                  <Text style={styles.goods} orphans={3} widows={3}>
                    <Text style={styles.label}>Goods and services: </Text>
                    {mark.goods}
                  </Text>
                )}
                {mark.serialNumber && /^\d{8}$/.test(mark.serialNumber) && (
                  <Link
                    style={styles.link}
                    src={`https://tsdr.uspto.gov/#caseNumber=${mark.serialNumber}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch`}
                  >
                    View USPTO record - {mark.serialNumber}
                  </Link>
                )}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

export async function renderTrademarkPdf(report: TrademarkReport): Promise<Buffer> {
  return renderToBuffer(trademarkReportDocument(report))
}
