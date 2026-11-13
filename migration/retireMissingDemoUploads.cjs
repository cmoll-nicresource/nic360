// One-time, staff-approved beta cleanup. Caller owns the transaction and saves
// the preview snapshot privately before applying its exact checksum.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Self-contained CommonJS module executed over private SSH.
const { createHash } = require('node:crypto')

const media = [
  [83, 'nic360-trademark-placeholder-7.png', 68],
  [84, 'international-tax-rates-5.csv', 361],
  [85, 'cigarette-market-share-by-company-5.csv', 417],
  [86, 'nic360-guide-thumbnail-5.png', 68],
  [87, 'nic360-Altria-ad-placeholder.png', 68],
  [88, 'nic360-BAT-Group-ad-placeholder.png', 68],
  [89, 'nic360-JUUL-Labs-ad-placeholder.png', 68],
  [90, 'nic360-Speaker-headshot-placeholder-3.png', 68],
  [91, 'nic360-Sponsor-logo-placeholder-3.png', 68],
]
const ids = media.map(([id]) => id)
const tables = ['media', 'guide_files', 'guides', '_guides_v', 'datasets', 'speakers', 'sponsors']
const predicates = {
  media: 'id BETWEEN 83 AND 91', guide_files: 'id=13', guides: 'id BETWEEN 58 AND 62',
  _guides_v: 'id BETWEEN 58 AND 67', datasets: 'id IN (124,126)', speakers: 'id BETWEEN 61 AND 65', sponsors: 'id BETWEEN 37 AND 39',
}
const allowed = {
  'guides.thumbnail_id': [[58,86],[59,86],[60,86],[61,86],[62,86]],
  '_guides_v.version_thumbnail_id': Array.from({ length: 10 }, (_, i) => [58+i,86]),
  '_guides_v.version_file_id': Array.from({ length: 5 }, (_, i) => [58+i,13]),
  'datasets.last_import_file_id': [[124,84],[126,85]],
  'speakers.headshot_id': Array.from({ length: 5 }, (_, i) => [61+i,90]),
  'sponsors.logo_id': [[37,91],[38,91],[39,91]],
}
const quote = value => '"' + value.replaceAll('"', '""') + '"'

async function inspect(client, lock = false) {
  const rows = {}
  for (const table of tables) rows[table] = (await client.query(`SELECT * FROM ${quote(table)} WHERE ${predicates[table]} ORDER BY id${lock ? ' FOR UPDATE' : ''}`)).rows
  for (const [id, filename, size] of [...media, [13, 'nic360-guide-placeholder-5.pdf', 239]]) {
    const row = rows[id === 13 ? 'guide_files' : 'media'].find(r => r.id === id)
    if (!row || row.filename !== filename || Number(row.filesize) !== size) throw Error(`Demo asset identity changed: ${id}`)
  }
  const files = { 58:28, 59:27, 60:25, 61:24, 62:26 }
  if (rows.guides.length !== 5 || rows._guides_v.length !== 10) throw Error('Guide history differs from reviewed scope')
  for (const guide of rows.guides) if (guide.file_id !== files[guide.id]) throw Error('Current guide PDF changed')
  for (const version of rows._guides_v) {
    if (version.id <= 62 && (version.latest !== false || version.version_file_id !== 13 || version.parent_id !== version.id)) throw Error('Demo guide version is no longer obsolete')
    if (version.id > 62 && (version.latest !== true || version.version_file_id !== files[version.parent_id])) throw Error('Current guide version changed')
  }
  const constraints = (await client.query(`SELECT n.nspname AS schema,t.relname AS table,a.attname AS column,c.confrelid::regclass::text AS target,cardinality(c.conkey) AS columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid IN ('media'::regclass,'guide_files'::regclass) ORDER BY n.nspname,t.relname,a.attname`)).rows
  const references = []
  for (const fk of constraints) {
    if (fk.columns !== 1) throw Error('Unexpected composite asset relationship')
    const targetIds = fk.target.endsWith('guide_files') ? [13] : ids
    const matches = (await client.query(`SELECT id,${quote(fk.column)} AS asset FROM ${quote(fk.schema)}.${quote(fk.table)} WHERE ${quote(fk.column)}=ANY($1::int[]) ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [targetIds])).rows.map(r => [r.id, r.asset])
    if (JSON.stringify(matches) !== JSON.stringify(allowed[`${fk.table}.${fk.column}`] || [])) throw Error(`Asset references changed: ${fk.table}.${fk.column}`)
    references.push({ ...fk, matches })
  }
  // A missing/removed FK must not bypass the reviewed relationship checks.
  for (const key of Object.keys(allowed)) if (!references.some(fk => `${fk.table}.${fk.column}` === key)) throw Error('Missing expected asset relationship: ' + key)
  const snapshot = { rows, references }
  return { snapshot, fingerprint: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') }
}

async function apply(client, expected) {
  const { snapshot, fingerprint } = await inspect(client, true)
  if (!expected || fingerprint !== expected) throw Error('Snapshot changed; prepare a new preview')
  const removedVersions = await client.query('DELETE FROM _guides_v WHERE id BETWEEN 58 AND 62 AND latest=false AND version_file_id=13')
  if (removedVersions.rowCount !== 5) throw Error('Unexpected retired guide version count')
  await client.query('UPDATE guides SET thumbnail_id=NULL WHERE id BETWEEN 58 AND 62 AND thumbnail_id=86')
  await client.query('UPDATE _guides_v SET version_thumbnail_id=NULL WHERE id BETWEEN 63 AND 67 AND version_thumbnail_id=86')
  await client.query('UPDATE datasets SET last_import_file_id=NULL WHERE (id=124 AND last_import_file_id=84) OR (id=126 AND last_import_file_id=85)')
  await client.query('UPDATE speakers SET headshot_id=NULL WHERE id BETWEEN 61 AND 65 AND headshot_id=90')
  await client.query('UPDATE sponsors SET logo_id=NULL WHERE id BETWEEN 37 AND 39 AND logo_id=91')
  const removedMedia = await client.query('DELETE FROM media WHERE id=ANY($1::int[])', [ids])
  const removedPdf = await client.query('DELETE FROM guide_files WHERE id=13')
  if (removedMedia.rowCount !== 9 || removedPdf.rowCount !== 1) throw Error('Unexpected retired asset count')
  // Every surviving field must remain identical except the approved stale links.
  for (const table of tables) {
    const expectedRows = snapshot.rows[table].filter(row => !['media','guide_files'].includes(table) && !(table === '_guides_v' && row.id <= 62)).map(row => {
      const next = { ...row }
      const column = { guides:'thumbnail_id', _guides_v:'version_thumbnail_id', datasets:'last_import_file_id', speakers:'headshot_id', sponsors:'logo_id' }[table]
      if (column) next[column] = null
      return next
    })
    const actualRows = (await client.query(`SELECT * FROM ${quote(table)} WHERE ${predicates[table]} ORDER BY id`)).rows
    if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) throw Error('Unexpected change outside retired links: ' + table)
  }
  return { retiredUploads: 10, retiredDemoGuideVersions: 5, preservedCurrentGuides: 5, clearedGuideThumbnails: 5, clearedDatasetSampleLinks: 2, clearedSpeakerHeadshots: 5, clearedSponsorLogos: 3 }
}

module.exports = { inspect, apply }
