import { requireStaff } from '@/lib/requireStaff'
import {
  companyReportInput,
  CompanyReportInputError,
  companyUsageCsv,
  getCompanyUsage,
} from '@/lib/companyUsage'

export async function GET(request: Request) {
  try {
    const { payload, user } = await requireStaff('gatekeeper')
    const sp = new URL(request.url).searchParams
    const input = companyReportInput(
      sp.get('providerId') ?? '',
      sp.get('from') ?? '',
      sp.get('to') ?? '',
    )
    const report = await getCompanyUsage(payload, user, input)
    return new Response('\uFEFF' + companyUsageCsv(report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="company-${input.providerId}-usage-${input.from}-${input.to}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof Response) return e
    if (e instanceof CompanyReportInputError)
      return Response.json(
        { error: e.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      )
    console.error('Company usage export failed', e)
    return Response.json({ error: 'Unable to generate the company usage report.' }, { status: 500 })
  }
}
