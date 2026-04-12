import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          borderRadius: '6px',
          fontFamily: 'sans-serif',
          fontSize: 20,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-1px',
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
