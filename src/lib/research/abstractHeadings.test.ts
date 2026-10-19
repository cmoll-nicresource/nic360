import { expect, it } from 'vitest'
import { lexicalFromParagraphs, lexicalFromText } from '@/lib/lexical'
import { formatAbstractHeadings } from './abstractHeadings'
import { researchParagraphs } from './reportPdf'

it('puts structured abstract labels on separate paragraphs for the CMS and PDF', () => {
  const body = lexicalFromParagraphs([
    'Background Sub-ohm electronic cigarettes operate at higher power.',
    'Methods This study compared liquids.',
    'Results Aerosol contained phenol.',
    'Findings Higher levels were observed.',
    'Conclusions: The results highlight a concern.',
  ])
  const formatted = formatAbstractHeadings(body)
  expect(researchParagraphs(formatted)).toEqual([
    'Background',
    'Sub-ohm electronic cigarettes operate at higher power.',
    'Methods',
    'This study compared liquids.',
    'Results',
    'Aerosol contained phenol.',
    'Findings',
    'Higher levels were observed.',
    'Conclusions:',
    'The results highlight a concern.',
  ])
  expect(body.root.children).toHaveLength(5)
  expect(formatAbstractHeadings(formatted)).toBe(formatted)
})

it('preserves split and formatted text leaves, including scientific notation', () => {
  const body = lexicalFromText('Background ')
  body.root.children[0].children.push(
    { ...body.root.children[0].children[0], text: 'ECIG', format: 2 },
    {
      ...body.root.children[0].children[0],
      text: ' aerosols contain β-catenin at 1–2 ng/s.',
    },
  )
  const formatted = formatAbstractHeadings(body)
  expect(formatted.root.children[1].children[0]).toMatchObject({
    text: 'ECIG',
    format: 2,
  })
  expect(researchParagraphs(formatted)).toEqual([
    'Background',
    'ECIG aerosols contain β-catenin at 1–2 ng/s.',
  ])
})

it('respects an explicitly bold section label before lowercase text', () => {
  const body = lexicalFromText('Findings')
  body.root.children[0].children[0].format = 1
  body.root.children[0].children.push({
    ...body.root.children[0].children[0],
    text: ' lower concentrations were observed.',
    format: 0,
  })
  expect(researchParagraphs(formatAbstractHeadings(body))).toEqual([
    'Findings',
    'lower concentrations were observed.',
  ])
})

it('leaves ordinary prose, standalone labels and complex linked paragraphs unchanged', () => {
  for (const text of [
    'Background radiation was measured.',
    'Results indicate a change.',
    'Conclusions',
    'The background and findings remain in the sentence.',
  ]) {
    const body = lexicalFromText(text)
    expect(formatAbstractHeadings(body)).toBe(body)
  }
  expect(formatAbstractHeadings(null)).toBeNull()
  const linked = {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Background ' },
            {
              type: 'link',
              children: [
                { type: 'text', text: 'A linked scientific reference.' },
              ],
            },
          ],
        },
      ],
    },
  }
  expect(formatAbstractHeadings(linked)).toBe(linked)
})

it('recognizes complete multiword journal labels without splitting them halfway', () => {
  const body = lexicalFromParagraphs([
    'Conclusions and relevance The intervention was effective.',
    'Main outcomes and measures Blood pressure was measured.',
  ])
  expect(researchParagraphs(formatAbstractHeadings(body))).toEqual([
    'Conclusions and relevance',
    'The intervention was effective.',
    'Main outcomes and measures',
    'Blood pressure was measured.',
  ])
})
