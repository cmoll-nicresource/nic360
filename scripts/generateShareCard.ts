import sharp from 'sharp'
import { resolve } from 'node:path'

const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<rect width="1200" height="630" fill="#0e2a47"/>
<circle cx="1160" cy="70" r="340" fill="none" stroke="#5890b0" stroke-opacity=".25"/>
<circle cx="1160" cy="70" r="290" fill="none" stroke="#5890b0" stroke-opacity=".25"/>
<rect x="70" y="70" width="285" height="75" rx="5" fill="white"/>
<text x="70" y="250" font-family="Arial,sans-serif" font-size="16" letter-spacing="4" fill="#9bc9dd">INDUSTRY INTELLIGENCE</text>
<text x="65" y="345" font-family="Georgia,serif" font-size="76" fill="white">A clearer view of</text>
<text x="65" y="435" font-family="Georgia,serif" font-size="76" fill="white">your industry.</text>
<path d="M70 490h1060" stroke="#5890b0" stroke-opacity=".6"/>
<text x="70" y="545" font-family="Arial,sans-serif" font-size="23" fill="#c1d6e7">News. Policy. Markets. Trade.</text>
<text x="920" y="545" font-family="Arial,sans-serif" font-size="17" fill="#c1d6e7">nicotine360.org</text>
</svg>`
const logo = await sharp(resolve('public/logo.png'))
  .resize({ width: 245, height: 48, fit: 'inside' })
  .toBuffer()
await sharp(Buffer.from(artwork))
  .composite([{ input: logo, left: 90, top: 87 }])
  .png()
  .toFile(resolve('public/share-card.png'))
console.log('Generated public/share-card.png')
