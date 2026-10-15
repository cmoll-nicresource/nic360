/** Offline layout previews only. No CMS writes, imports, or emails. */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Trademark } from '../src/payload-types'
import {
  renderTrademarkPdf,
  type ReportMark,
  type TrademarkReport,
} from '../src/lib/tmog/reportPdf'

const output = path.resolve('tmp/trademark-reports')
await fs.mkdir(output, { recursive: true })
const artwork = await sharp(
  Buffer.from(
    '<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="200" fill="white"/><circle cx="150" cy="100" r="75" fill="#285888"/><path d="M100 135L150 55L200 135Z" fill="#ffffff"/></svg>',
  ),
)
  .png()
  .toBuffer()
const marks: ReportMark[] = Array.from(
  { length: 12 },
  (_, index) =>
    ({
      id: index + 1,
      title: `${['EXAMPLE SUMMIT', 'EXAMPLE CAFÉ ÉLAN', 'EXAMPLE HARBOR', 'EXAMPLE NORTHSTAR'][index % 4]} ${index + 1}`,
      serialNumber: String(90000000 + index),
      registrationNumber: String(7000000 + index),
      owner:
        index === 3
          ? 'Example International Tobacco and Smoking Accessories Company Limited'
          : 'Example Holdings LLC',
      ownerAddress: '100 Example Avenue, Richmond, Virginia 23219, United States',
      class: '34',
      publishedDate: '2026-10-13',
      renewedDate: '2026-09-22',
      cancelledDate: '2026-09-08',
      filedDate: '2025-08-20',
      registeredDate: '2020-09-01',
      goods:
        index === 4
          ? 'Tobacco substitutes; electronic cigarettes; cigarette holders and cases; smoking accessories. '.repeat(
              80,
            )
          : 'Electronic cigarettes; oral vaporizers for smokers; tobacco substitutes, not for medical purposes; smoking accessories.',
      reportImage: index % 3 === 0 ? artwork : undefined,
      renewal: {
        owner: 'Example Renewed Owner Inc.',
        address: '200 Example Street, New York, NY 10001',
      },
    }) as Trademark & { reportImage?: Buffer },
)

const reports: TrademarkReport[] = [
  {
    kind: 'weekly',
    title: 'Weekly US Trademark Report',
    period: 'Week ending October 13, 2026',
    generatedAt: new Date('2026-10-15'),
    sections: [{ title: 'Published for opposition', marks, dateField: 'publishedDate' }],
  },
  {
    kind: 'monthly',
    title: 'Monthly US Trademark Activity',
    period: 'September 2026',
    generatedAt: new Date('2026-10-15'),
    sections: [
      {
        title: 'Published for opposition',
        marks: marks.slice(0, 4).map((mark) => ({ ...mark, publishedDate: '2026-09-15' })),
        dateField: 'publishedDate',
      },
      { title: 'Cancellations', marks: marks.slice(0, 7), dateField: 'cancelledDate' },
      { title: 'Renewals', marks: marks.slice(7), dateField: 'renewedDate' },
    ],
  },
]
for (const report of reports) {
  const target = path.join(output, `${report.kind}-preview.pdf`)
  await fs.writeFile(target, await renderTrademarkPdf(report))
  console.log(`${report.kind}: ${target} (illustrative records only)`)
}
