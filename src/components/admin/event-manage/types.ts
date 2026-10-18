import type {
  DiscountCode,
  Event,
  EventRegistration,
  Session,
  Speaker,
  Sponsor,
} from '@/payload-types'
import type {
  AttendeeReportRow,
  AttendeeReportTotals,
  SessionPopularityRow,
} from '@/lib/eventAnalytics'

export type SimpleUser = {
  id: number
  email: string
  firstName?: string | null
  lastName?: string | null
}
export type SimpleAccessProvider = { id: number; name: string }

export type EventManageDashboardProps = {
  event: Event
  sessionCount: number
  activeAttendeeCount: number | null
  registrationCount: number
  sessions: Session[]
  allSponsors: Sponsor[]
  allSpeakers: Speaker[]
  discountCodes: DiscountCode[]
  registrations: EventRegistration[]
  accessProviders: SimpleAccessProvider[]
  canManageRegistrations: boolean
  operationsOnly?: boolean
  adminEditUrl: string
  attendeeReport: AttendeeReportRow[]
  attendeeReportTotals: AttendeeReportTotals
  sessionPopularity: SessionPopularityRow[]
}
