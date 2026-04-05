import { ImageResponse } from 'next/og'
import { brandHeadphoneIconDataUrl } from '@/lib/brand-headphone-icon-svg'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    { ...size }
  )
}
