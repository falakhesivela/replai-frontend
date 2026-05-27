export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: 'transparent' }}>
      <body style={{ margin: 0, padding: 0, background: 'transparent', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
