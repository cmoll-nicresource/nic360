import { EDITORIAL_PHOTOS, type EditorialPhotoKey } from '@/config/editorialPhotos'

/** Pre-sized static WebPs avoid sending stock-photo originals or optimizing them again at runtime. */
export function EditorialPhoto({
  photo,
  className = '',
  sizes = '(max-width: 600px) 100vw, 50vw',
  decorative = false,
  eager = false,
}: {
  photo: EditorialPhotoKey
  className?: string
  sizes?: string
  decorative?: boolean
  eager?: boolean
}) {
  const asset = EDITORIAL_PHOTOS[photo]
  const base = `/images/editorial/${asset.file}`
  return (
    <div className={`editorial-photo ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Responsive WebPs are generated at build-preparation time, with an explicit native srcset. */}
      <img
        src={`${base}-1280.webp`}
        srcSet={`${base}-640.webp 640w, ${base}-1280.webp 1280w, ${base}-1920.webp 1920w`}
        sizes={sizes}
        width={asset.width}
        height={asset.height}
        alt={decorative ? '' : asset.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ objectPosition: asset.position }}
      />
    </div>
  )
}
