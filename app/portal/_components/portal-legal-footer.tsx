import { LEGAL_LINKS } from '@/lib/marketing-site'

export function PortalLegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400 ${className}`}
    >
      {LEGAL_LINKS.map((link, i) => (
        <span key={link.href} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden="true">·</span>}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 transition-colors"
          >
            {link.label}
          </a>
        </span>
      ))}
    </footer>
  )
}
