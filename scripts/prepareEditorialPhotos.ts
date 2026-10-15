import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { EDITORIAL_PHOTOS } from '../src/config/editorialPhotos'

const sourceNames = {
  port: 'container port aerial.jpeg',
  shipping: 'international trade port shipping.jpeg',
  lansdowne: 'lansdowne ATNF.jpg',
  capitol: 'state capitol.jpeg',
  chamber: 'state legislative chamber empty.jpeg',
  field: 'tobacco field aerial.jpeg',
  barn: 'tobacco leaves drying barn.jpeg',
  stamp: 'trademark stamp.jpeg',
} as const
const originals = path.resolve('assets/photography/originals')
const output = path.resolve('public/images/editorial')
await fs.mkdir(output, { recursive: true })
let originalBytes = 0
let webBytes = 0
for (const key of Object.keys(EDITORIAL_PHOTOS) as (keyof typeof EDITORIAL_PHOTOS)[]) {
  const asset = EDITORIAL_PHOTOS[key]
  const input = path.join(originals, sourceNames[key])
  originalBytes += (await fs.stat(input)).size
  for (const width of [640, 1280, 1920]) {
    const destination = path.join(output, `${asset.file}-${width}.webp`)
    await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toFile(destination)
    webBytes += (await fs.stat(destination)).size
  }
}
console.log(
  `Prepared 24 responsive WebPs: ${(webBytes / 1024 / 1024).toFixed(2)} MB total; originals ${(originalBytes / 1024 / 1024).toFixed(2)} MB retained separately.`,
)
