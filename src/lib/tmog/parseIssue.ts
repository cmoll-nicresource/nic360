import { SaxesParser, type SaxesTagNS } from 'saxes'

import { classifyRecord, type TrademarkStatus } from './classify'

export type ParsedTrademark = {
  serial: string
  registrationNumber: string
  markText: string
  owner: string
  goods: string
  imageFileName: string
  status: TrademarkStatus
  statusDate: string
}

// Leaf (text-only) elements we care about, matched by local name — the real
// feed is inconsistent about whether some of these sit under the tmk or com
// prefix (e.g. PublicationSubsection), so we ignore namespace URI entirely
// and match on local name alone.
const LEAF_FIELDS = new Set([
  'ApplicationNumberText',
  'RegistrationNumber',
  'MarkSignificantVerbalElementText',
  'MarkCurrentStatusCode',
  'MarkCurrentStatusDate',
  'OrganizationStandardName',
  'PersonFullName',
  'GoodsServicesDescriptionText',
  'ImageFileName',
  'ClassNumber',
  'PublicationSectionCategory',
])

type Accumulator = {
  serial: string
  registrationNumber: string
  markText: string
  orgName: string
  personName: string
  goodsParts: string[]
  imageFileName: string
  classes: string[]
  sections: string[]
  statusCode: string
  statusDate: string
}

function blankAccumulator(): Accumulator {
  return {
    serial: '',
    registrationNumber: '',
    markText: '',
    orgName: '',
    personName: '',
    goodsParts: [],
    imageFileName: '',
    classes: [],
    sections: [],
    statusCode: '',
    statusDate: '',
  }
}

function finalizeRecord(acc: Accumulator): ParsedTrademark | null {
  if (!acc.classes.includes('34')) return null

  let status: TrademarkStatus | null = null
  for (const section of acc.sections) {
    status = classifyRecord(section, acc.statusCode)
    if (status) break
  }
  if (!status) return null

  return {
    serial: acc.serial,
    registrationNumber: acc.registrationNumber,
    markText: acc.markText || `Serial #${acc.serial}`,
    owner: acc.orgName || acc.personName,
    goods: acc.goodsParts.join(' / '),
    imageFileName: acc.imageFileName,
    status,
    statusDate: acc.statusDate,
  }
}

/**
 * Streams a TMOG issue XML document (a `tmk:Trademark` per record, ~23,000 of
 * them in ~200MB) and yields only the class-34 records that match a tracked
 * TMOG section. Memory use is bounded to the current record plus whatever
 * finished between two chunk reads — never the whole file or a DOM.
 */
export async function* parseTrademarkIssue(body: ReadableStream<Uint8Array>): AsyncGenerator<ParsedTrademark> {
  const parser = new SaxesParser({ xmlns: true })

  const stack: string[] = []
  let trademarkDepth = -1
  let acc: Accumulator | null = null
  let currentLeaf: string | null = null
  let leafBuffer = ''
  const ready: ParsedTrademark[] = []
  let parseError: Error | null = null

  parser.on('error', (err) => {
    parseError = err
  })

  parser.on('opentag', (tag: SaxesTagNS) => {
    stack.push(tag.local)

    if (tag.local === 'Trademark' && trademarkDepth === -1) {
      trademarkDepth = stack.length
      acc = blankAccumulator()
      return
    }

    if (!acc) return

    if (tag.local === 'RegistrationNumber') {
      // Spec requires this to be a *direct child* of Trademark — there's an
      // unrelated, deeper RegistrationNumber under PreviousRegistrationBag
      // for some records that must not be picked up instead.
      if (stack.length - trademarkDepth === 1) {
        currentLeaf = 'RegistrationNumber'
        leafBuffer = ''
      }
      return
    }

    if (LEAF_FIELDS.has(tag.local)) {
      currentLeaf = tag.local
      leafBuffer = ''
    }
  })

  parser.on('text', (text: string) => {
    if (currentLeaf) leafBuffer += text
  })

  parser.on('closetag', (tag: SaxesTagNS) => {
    if (acc && currentLeaf === tag.local) {
      const value = leafBuffer.trim()
      switch (tag.local) {
        case 'ApplicationNumberText':
          if (!acc.serial) acc.serial = value
          break
        case 'RegistrationNumber':
          if (!acc.registrationNumber) acc.registrationNumber = value
          break
        case 'MarkSignificantVerbalElementText':
          if (!acc.markText) acc.markText = value
          break
        case 'MarkCurrentStatusCode':
          if (!acc.statusCode) acc.statusCode = value
          break
        case 'MarkCurrentStatusDate':
          if (!acc.statusDate) acc.statusDate = value
          break
        case 'OrganizationStandardName':
          if (!acc.orgName) acc.orgName = value
          break
        case 'PersonFullName':
          if (!acc.personName) acc.personName = value
          break
        case 'GoodsServicesDescriptionText':
          if (value) acc.goodsParts.push(value)
          break
        case 'ImageFileName':
          if (!acc.imageFileName) acc.imageFileName = value
          break
        case 'ClassNumber':
          if (value) acc.classes.push(value)
          break
        case 'PublicationSectionCategory':
          if (value) acc.sections.push(value)
          break
      }
      currentLeaf = null
      leafBuffer = ''
    }

    stack.pop()

    if (tag.local === 'Trademark' && acc) {
      const record = finalizeRecord(acc)
      if (record) ready.push(record)
      acc = null
      trademarkDepth = -1
    }
  })

  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parser.write(decoder.decode(value, { stream: true }))
      if (parseError) throw parseError
      while (ready.length) yield ready.shift()!
    }
    parser.write(decoder.decode())
    parser.close()
    if (parseError) throw parseError
    while (ready.length) yield ready.shift()!
  } finally {
    reader.releaseLock()
  }
}
