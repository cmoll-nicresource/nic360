import { Readable } from 'stream'
import { describe, expect, it } from 'vitest'

import { parseTrademarkIssue } from './parseIssue'

function record(inner: string) {
  return `<tmk:Trademark>${inner}</tmk:Trademark>`
}

function appNum(serial: string) {
  return `<com:ApplicationNumber><com:IPOfficeCode>US</com:IPOfficeCode><com:ApplicationNumberText>${serial}</com:ApplicationNumberText></com:ApplicationNumber>`
}

function classes(nums: string[]) {
  return (
    `<tmk:GoodsServicesClassificationBag>${nums
      .map(
        (n) =>
          `<tmk:GoodsServicesClassification><tmk:ClassificationKindCode>Nice</tmk:ClassificationKindCode><tmk:ClassNumber>${n}</tmk:ClassNumber></tmk:GoodsServicesClassification>`,
      )
      .join('')}</tmk:GoodsServicesClassificationBag>` +
    `<tmk:ClassDescriptionBag>${nums
      .map(
        (n) =>
          `<tmk:ClassDescription><tmk:ClassNumber>${n}</tmk:ClassNumber><tmk:GoodsServicesDescriptionText com:sequenceNumber="1">Goods for class ${n}</tmk:GoodsServicesDescriptionText></tmk:ClassDescription>`,
      )
      .join('')}</tmk:ClassDescriptionBag>`
  )
}

function orgOwner(name: string) {
  return `<tmk:ApplicantBag><tmk:Applicant com:sequenceNumber="1"><com:Contact><com:Name><com:OrganizationName><com:OrganizationStandardName>${name}</com:OrganizationStandardName></com:OrganizationName></com:Name></com:Contact></tmk:Applicant></tmk:ApplicantBag>`
}

function personOwner(name: string) {
  return `<tmk:ApplicantBag><tmk:Applicant com:sequenceNumber="1"><com:Contact><com:Name><com:PersonName><com:PersonFullName>${name}</com:PersonFullName></com:PersonName></com:Name></com:Contact></tmk:Applicant></tmk:ApplicantBag>`
}

function publication(section: string, subsection: string) {
  // Real feed mixes the tmk: and com: prefixes for PublicationSubsection depending on record — the parser
  // matches by local name only, so this deliberately uses the com: prefix to cover that quirk.
  return `<tmk:PublicationBag><tmk:Publication><com:PublicationIdentifier>USPTO Official Gazette for Trademarks (OG)</com:PublicationIdentifier><tmk:PublicationSectionCategory>${section}</tmk:PublicationSectionCategory><com:PublicationSubsection>${subsection}</com:PublicationSubsection></tmk:Publication></tmk:PublicationBag>`
}

function buildXml(records: string[]): string {
  return (
    `<?xml version='1.0' encoding='UTF-8'?><tmk:Transaction xmlns:tmk="http://www.wipo.int/standards/XMLSchema/Trademark/1" xmlns:com="http://www.wipo.int/standards/XMLSchema/Common/1"><tmk:TrademarkTransactionBody><tmk:TransactionContentBag><tmk:TransactionData><tmk:TrademarkBag>` +
    records.join('') +
    `</tmk:TrademarkBag></tmk:TransactionData></tmk:TransactionContentBag></tmk:TrademarkTransactionBody></tmk:Transaction>`
  )
}

/** Feeds the XML through the parser in small chunks, to exercise partial-tag handling across chunk boundaries, not just one big write. */
async function parseAll(xml: string, chunkSize = 97) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  for (let i = 0; i < xml.length; i += chunkSize) {
    chunks.push(encoder.encode(xml.slice(i, i + chunkSize)))
  }
  const webStream = Readable.toWeb(Readable.from(chunks)) as unknown as ReadableStream<Uint8Array>

  const out = []
  for await (const rec of parseTrademarkIssue(webStream)) out.push(rec)
  return out
}

describe('parseTrademarkIssue', () => {
  const records = [
    // Published, class 34, verbal mark, person owner, stale status code 681 (not 686)
    record(
      appNum('99000001') +
        '<tmk:MarkCurrentStatusCode>681</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-01</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>SMOKY RIDGE</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34']) +
        publication('Applications publishing for opposition', 'Trademark Publication - Principal Register') +
        personOwner('Jane Doe'),
    ),
    // Registered, class 34 + 9, org owner, direct-child RegistrationNumber + an irrelevant nested one
    record(
      '<com:RegistrationNumber>9123456</com:RegistrationNumber>' +
        appNum('99000002') +
        '<tmk:PreviousRegistrationBag><tmk:PreviousRegistration><com:RegistrationNumber>1111111</com:RegistrationNumber></tmk:PreviousRegistration></tmk:PreviousRegistrationBag>' +
        '<tmk:MarkCurrentStatusCode>686</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-10</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>BLUE LEAF</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34', '9']) +
        publication('Registrations publishing', 'Trademark Registration - Principal Register') +
        orgOwner('Blue Leaf Tobacco LLC'),
    ),
    // Cancelled, class 34, status code 710 (within 709-713)
    record(
      appNum('99000003') +
        '<tmk:MarkCurrentStatusCode>710</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-15</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>OLD EMBER</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34']) +
        publication('Registrations no longer in effect', 'Trademark Registration Cancelled - Section 8') +
        orgOwner('Old Ember Co'),
    ),
    // Excluded: same section but status code outside 709-713 (e.g. a 16A/16B removal)
    record(
      appNum('99000004') +
        '<tmk:MarkCurrentStatusCode>677</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-16</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>SHOULD BE DROPPED</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34']) +
        publication('Registrations no longer in effect', 'Section 16A removal') +
        orgOwner('Nobody Inc'),
    ),
    // Renewed, class 34
    record(
      '<com:RegistrationNumber>9999999</com:RegistrationNumber>' +
        appNum('99000005') +
        '<tmk:MarkCurrentStatusCode>800</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-20</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>LONG HAUL</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34']) +
        publication('Registrations renewed', 'Trademark Renewal - Principal Register') +
        orgOwner('Long Haul Tobacco Inc'),
    ),
    // Not class 34
    record(
      appNum('99000006') +
        '<tmk:MarkCurrentStatusCode>686</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-21</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>UNRELATED</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['25']) +
        publication('Applications publishing for opposition', 'Trademark Publication - Principal Register') +
        orgOwner('Shoe Co'),
    ),
    // Untracked section (e.g. New Certificate)
    record(
      appNum('99000007') +
        '<tmk:MarkCurrentStatusCode>702</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-22</tmk:MarkCurrentStatusDate>' +
        '<tmk:WordMarkSpecification><tmk:MarkSignificantVerbalElementText>CERT ONLY</tmk:MarkSignificantVerbalElementText></tmk:WordMarkSpecification>' +
        classes(['34']) +
        publication('New Certificate', 'New Certificate of Registration') +
        orgOwner('Cert Co'),
    ),
  ]

  it('keeps only class-34 records in a tracked section, and drops the rest', async () => {
    const out = await parseAll(buildXml(records))
    expect(out.map((r) => r.serial).sort()).toEqual(['99000001', '99000002', '99000003', '99000005'])
  })

  it('classifies by section, ignoring a stale MarkCurrentStatusCode', async () => {
    const out = await parseAll(buildXml(records))
    const bySerial = Object.fromEntries(out.map((r) => [r.serial, r]))
    expect(bySerial['99000001'].status).toBe('published')
    expect(bySerial['99000002'].status).toBe('registered')
    expect(bySerial['99000003'].status).toBe('cancelled')
    expect(bySerial['99000005'].status).toBe('renewed')
  })

  it('reads RegistrationNumber only as a direct child of Trademark, not the nested one in PreviousRegistrationBag', async () => {
    const out = await parseAll(buildXml(records))
    const r = out.find((x) => x.serial === '99000002')
    expect(r?.registrationNumber).toBe('9123456')
  })

  it('prefers OrganizationStandardName over PersonFullName, and falls back when only a person is present', async () => {
    const out = await parseAll(buildXml(records))
    const bySerial = Object.fromEntries(out.map((r) => [r.serial, r]))
    expect(bySerial['99000001'].owner).toBe('Jane Doe')
    expect(bySerial['99000002'].owner).toBe('Blue Leaf Tobacco LLC')
  })

  it('joins GoodsServicesDescriptionText from every class with " / "', async () => {
    const out = await parseAll(buildXml(records))
    const r = out.find((x) => x.serial === '99000002')
    expect(r?.goods).toBe('Goods for class 34 / Goods for class 9')
  })

  it('falls back to a serial-based title when MarkSignificantVerbalElementText is empty (design-only marks)', async () => {
    const noWordMark = record(
      appNum('99000008') +
        '<tmk:MarkCurrentStatusCode>686</tmk:MarkCurrentStatusCode><tmk:MarkCurrentStatusDate>2026-09-23</tmk:MarkCurrentStatusDate>' +
        classes(['34']) +
        publication('Applications publishing for opposition', 'Trademark Publication - Principal Register') +
        orgOwner('Design Only Co'),
    )
    const out = await parseAll(buildXml([noWordMark]))
    expect(out[0].markText).toBe('Serial #99000008')
  })

  it('handles an empty TrademarkBag without error', async () => {
    const out = await parseAll(buildXml([]))
    expect(out).toEqual([])
  })
})
