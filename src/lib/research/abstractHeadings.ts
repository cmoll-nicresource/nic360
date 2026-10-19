type Node = {
  type?: string
  text?: string
  format?: number | string
  children?: Node[]
  [key: string]: unknown
}

const section =
  /^(Background and aims|Methods and findings|Methods and results|Materials and methods|Research design and methods|Main outcomes? (?:and )?measures|Conclusions and relevance|Conclusions and implications|Design, setting, and participants|Data extraction and synthesis|Data sources|Study selection|Key findings|Strengths and limitations|Trial registration|Background|Introduction|Importance|Objectives?|Aims?|Purpose|Methods?|Methodology|Design|Setting|Participants|Interventions|Results|Findings|Discussion|Conclusions?|Interpretation|Implications|Funding)(\s*:)?\s+(?=\S)/i

/** Split run-in abstract labels without flattening italics, emphasis or scientific text. */
export function formatAbstractHeadings<T>(body: T): T {
  const doc = body as { root?: Node } | null
  if (!doc?.root?.children) return body
  let changed = false
  const children = doc.root.children.flatMap((paragraph) => {
    const leaves = paragraph.children
    if (
      paragraph.type !== 'paragraph' ||
      !leaves?.length ||
      leaves.some(
        (node) => node.type !== 'text' || typeof node.text !== 'string',
      )
    )
      return [paragraph]
    const text = leaves.map((node) => node.text).join('')
    const match = section.exec(text)
    if (!match) return [paragraph]
    const labelLength = match[1].length + (match[2]?.length ?? 0)
    // A lowercase continuation is usually ordinary prose, unless the source explicitly emphasized the label.
    let offset = 0
    const emphasized = leaves
      .filter((node) => {
        const start = offset
        offset += node.text!.length
        return start < labelLength
      })
      .every(
        (node) => typeof node.format === 'number' && (node.format & 1) !== 0,
      )
    if (!emphasized && !/^[\p{Lu}\d(“"']/u.test(text.slice(match[0].length)))
      return [paragraph]
    const slice = (from: number, until: number) => {
      let position = 0
      return leaves.flatMap((node) => {
        const start = position
        position += node.text!.length
        const value = node.text!.slice(
          Math.max(0, from - start),
          Math.max(0, Math.min(node.text!.length, until - start)),
        )
        return value ? [{ ...node, text: value }] : []
      })
    }
    changed = true
    return [
      { ...paragraph, children: slice(0, labelLength) },
      { ...paragraph, children: slice(match[0].length, text.length) },
    ]
  })
  return changed ? ({ ...body, root: { ...doc.root, children } } as T) : body
}
