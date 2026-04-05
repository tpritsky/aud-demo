import { ImageResponse } from 'next/og'
import { brandHeadphoneIconDataUrl } from '@/lib/brand-headphone-icon-svg'

/** PNG favicon for search + browsers (Google often ignores SVG-only icons). */
export const size = { width: 48, height: 48 }
export const contentType = 'image/png'

export default function Icon() {
  const src = brandHeadphoneIconDataUrl()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse runtime */}
        <img src={src} width={48} height={48} alt="" />
      </div>
    ),
    { ...size }
  )
}
