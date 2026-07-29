'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  saveMyWidgetConfig,
  uploadMyWidgetAvatar,
  PortalAuthError,
  type TokenGetter,
} from '@/lib/api'
import type { WidgetConfig } from '@/lib/types'

interface Props {
  initialConfig: WidgetConfig
}

const THEME_PRESETS: { name: string; color: string }[] = [
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Violet', color: '#7c3aed' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Rose', color: '#e11d48' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Slate', color: '#0f172a' },
  { name: 'Cyan', color: '#0891b2' },
]

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [99, 102, 241]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function isColorDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum < 0.6
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function WidgetSettingsForm({ initialConfig }: Props) {
  const router = useRouter()
  const [welcomeMessage, setWelcomeMessage] = useState(initialConfig.welcome_message)
  const [brandColor, setBrandColor] = useState(initialConfig.brand_color)
  const [position, setPosition] = useState<WidgetConfig['position']>(initialConfig.position)
  const [collectLead, setCollectLead] = useState(initialConfig.collect_lead)
  const [agentName, setAgentName] = useState(initialConfig.agent_name)
  const [agentTagline, setAgentTagline] = useState(initialConfig.agent_tagline)
  const [agentAvatarUrl, setAgentAvatarUrl] = useState<string | null>(initialConfig.agent_avatar_url)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [widgetId, setWidgetId] = useState(initialConfig.widget_id)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getFreshToken = useCallback<TokenGetter>(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  async function handleAvatarFile(file: File) {
    setError(null)
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar exceeds the 2 MB limit.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Avatar must be an image.')
      return
    }
    setAvatarUploading(true)
    try {
      const { url } = await uploadMyWidgetAvatar(getFreshToken, file)
      setAgentAvatarUrl(url)
    } catch (err) {
      if (err instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      setError('Avatar upload failed.')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await saveMyWidgetConfig(getFreshToken, {
        welcome_message: welcomeMessage,
        brand_color: brandColor,
        position,
        collect_lead: collectLead,
        agent_name: agentName.trim() || 'Support',
        agent_tagline: agentTagline.trim() || 'Typically replies in seconds',
        agent_avatar_url: agentAvatarUrl,
      })
      setWidgetId(updated.widget_id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      if (err instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Chatbot Widget</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Configure your live chat widget and embed it on any website.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Settings */}
        <form onSubmit={handleSave} className="space-y-6">
          <Card
            title="Agent identity"
            subtitle="The name, tagline, and avatar shown in the chat header and prechat bubble."
          >
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <AvatarUploader
                  url={agentAvatarUrl}
                  brandColor={brandColor}
                  uploading={avatarUploading}
                  onPick={handleAvatarFile}
                  onClear={() => setAgentAvatarUrl(null)}
                />
                <div className="flex-1 space-y-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-2 mb-1">
                      Agent name
                    </span>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      maxLength={40}
                      placeholder="Support"
                      className="w-full rounded-xl border border-line bg-surface shadow-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-2 mb-1">
                      Tagline
                    </span>
                    <input
                      type="text"
                      value={agentTagline}
                      onChange={(e) => setAgentTagline(e.target.value)}
                      maxLength={60}
                      placeholder="Typically replies in seconds"
                      className="w-full rounded-xl border border-line bg-surface shadow-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Greeting" subtitle="The first thing visitors see when they open the widget.">
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              maxLength={240}
              placeholder="Hi there! How can I help you today?"
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-ink-3">
                Shown both as a teaser bubble and inside the chat window.
              </p>
              <span className="text-xs text-ink-3">{welcomeMessage.length}/240</span>
            </div>
          </Card>

          <Card title="Appearance" subtitle="Match your brand and pick where the widget sits.">
            <div className="space-y-5">
              {/* Theme presets */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-2">
                  Theme presets
                </label>
                <div className="flex flex-wrap gap-2">
                  {THEME_PRESETS.map((preset) => {
                    const active = preset.color.toLowerCase() === brandColor.toLowerCase()
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setBrandColor(preset.color)}
                        title={preset.name}
                        className={`relative h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                          active ? 'ring-2 ring-offset-2 ring-accent' : ''
                        }`}
                        style={{ backgroundColor: preset.color }}
                      >
                        {active && (
                          <Check
                            size={14}
                            className="absolute inset-0 m-auto"
                            style={{ color: isColorDark(preset.color) ? '#fff' : '#111' }}
                          />
                        )}
                        <span className="sr-only">{preset.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom color */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Custom color
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded border border-line bg-surface p-0.5"
                    />
                  </div>
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                        setBrandColor(v.startsWith('#') ? v : `#${v}`)
                      }
                    }}
                    className="w-28 rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs uppercase text-ink-2 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Widget position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['bottom-left', 'bottom-right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(pos)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        position === pos
                          ? 'border-accent bg-surface-2 text-ink'
                          : 'border-line text-ink-2 hover:bg-surface-2'
                      }`}
                    >
                      <PositionIcon side={pos === 'bottom-right' ? 'right' : 'left'} active={position === pos} />
                      <span className="font-medium">
                        {pos === 'bottom-right' ? 'Bottom right' : 'Bottom left'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Behavior" subtitle="What happens before the visitor sends their first message.">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface-2 p-4">
              <div>
                <p className="text-sm font-medium text-ink">Collect visitor info</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  Show a name + email form before the chat starts. Useful for lead capture.
                </p>
              </div>
              <Toggle checked={collectLead} onChange={setCollectLead} />
            </div>
          </Card>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-line bg-surface/80 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-none lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-solid transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success">
                <Check size={14} /> Changes live
              </span>
            )}
          </div>

          <EmbedCode widgetId={widgetId} />
        </form>

        {/* Live preview */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Preview</p>
            <WidgetPreview
              brandColor={brandColor}
              welcomeMessage={welcomeMessage || 'Hi! How can we help?'}
              position={position}
              collectLead={collectLead}
              agentName={agentName || 'Support'}
              agentTagline={agentTagline || 'Typically replies in seconds'}
              agentAvatarUrl={agentAvatarUrl}
            />
            {widgetId && (
              <a
                href={`/widget/${widgetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
              >
                Open live preview <ExternalLink size={11} />
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// Pieces

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function AvatarUploader({
  url,
  brandColor,
  uploading,
  onPick,
  onClear,
}: {
  url: string | null
  brandColor: string
  uploading: boolean
  onPick: (file: File) => void | Promise<void>
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 text-ink-3 transition-colors hover:bg-surface-2 disabled:opacity-60"
        style={url ? { backgroundColor: brandColor } : undefined}
        aria-label="Upload avatar"
      >
        {uploading ? (
          <Loader2 size={18} className="animate-spin text-on-solid" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Agent avatar" className="h-full w-full object-cover" />
        ) : (
          <Upload size={18} />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onPick(f)
        }}
      />
      {url ? (
        <button
          type="button"
          onClick={onClear}
          disabled={uploading}
          className="flex items-center gap-1 text-[11px] font-medium text-ink-2 hover:text-danger disabled:opacity-50"
        >
          <Trash2 size={11} /> Remove
        </button>
      ) : (
        <span className="text-[11px] text-ink-3">PNG / JPG · 2 MB</span>
      )}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-surface shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function PositionIcon({ side, active }: { side: 'left' | 'right'; active: boolean }) {
  const fill = active ? '#111827' : '#9ca3af'
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="21" height="15" rx="2" stroke={fill} strokeOpacity="0.4" />
      <circle cx={side === 'right' ? 18 : 4} cy="12" r="2" fill={fill} />
    </svg>
  )
}

function EmbedCode({ widgetId }: { widgetId: string }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const snippet = useMemo(() => {
    if (!widgetId) return '<!-- Save your settings to generate the embed code. -->'
    // A loader script (not a bare iframe) — the iframe resizes itself based on
    // postMessages from the widget so the launcher doesn't block the page when
    // the chat is closed.
    return `<!-- Replai chat widget -->
<script>
(function(){
  var SRC="${origin}/widget/${widgetId}";
  var Z=2147483647;
  var f=document.createElement("iframe");
  f.src=SRC;f.title="Chat";f.allow="microphone";
  f.setAttribute("aria-label","Chat widget");
  function sizes(side){
    var anchor=(side==="left")?"left:0;":"right:0;";
    return {
      closed:"position:fixed;bottom:0;"+anchor+"width:96px;height:96px;border:0;z-index:"+Z+";background:transparent;color-scheme:normal;transition:width .2s,height .2s",
      prechat:"position:fixed;bottom:0;"+anchor+"width:360px;height:160px;max-width:100vw;border:0;z-index:"+Z+";background:transparent;color-scheme:normal;transition:width .2s,height .2s",
      opened:"position:fixed;bottom:0;"+anchor+"width:420px;height:720px;max-width:100vw;max-height:100dvh;border:0;z-index:"+Z+";background:transparent;color-scheme:normal;transition:width .2s,height .2s",
      mobile:"position:fixed;inset:0;width:100%;height:100%;border:0;z-index:"+Z+";background:transparent;color-scheme:normal"
    };
  }
  var side="right",S=sizes(side);
  f.style.cssText=S.closed;
  document.body.appendChild(f);
  function postLayout(){
    if(!f.contentWindow)return;
    f.contentWindow.postMessage({source:"replai-host",type:"layout",mobile:window.matchMedia("(max-width: 520px)").matches},"*");
  }
  f.addEventListener("load",postLayout);
  window.addEventListener("resize",postLayout);
  window.addEventListener("message",function(e){
    var d=e.data;
    if(!d||d.source!=="replai-widget")return;
    if(d.side&&d.side!==side){side=d.side;S=sizes(side);}
    var mobile=window.matchMedia("(max-width: 520px)").matches;
    if(d.type==="opened") f.style.cssText=mobile?S.mobile:S.opened;
    else if(d.type==="prechat") f.style.cssText=S.prechat;
    else f.style.cssText=S.closed; // ready / closed
    postLayout();
  });
})();
</script>`
  }, [origin, widgetId])

  async function copy() {
    if (!widgetId) return
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Install on your site</h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Paste this snippet just before <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">&lt;/body&gt;</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!widgetId}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-40"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2">
        {snippet}
      </pre>
    </section>
  )
}

// Live preview component

interface PreviewProps {
  brandColor: string
  welcomeMessage: string
  position: WidgetConfig['position']
  collectLead: boolean
  agentName: string
  agentTagline: string
  agentAvatarUrl: string | null
}

function WidgetPreview({
  brandColor,
  welcomeMessage,
  position,
  collectLead,
  agentName,
  agentTagline,
  agentAvatarUrl,
}: PreviewProps) {
  const onBrand = isColorDark(brandColor) ? '#ffffff' : '#111827'
  const isRight = position !== 'bottom-left'

  return (
    // data-theme="light": the preview shows the customer-facing widget, which
    // is always light — this resets the semantic tokens inside this subtree.
    <div
      data-theme="light"
      className="relative h-[560px] overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] shadow-inner"
    >
      {/* faux page hint */}
      <div className="absolute inset-x-6 top-6 space-y-2 opacity-60">
        <div className="h-2 w-1/3 rounded bg-line-strong" />
        <div className="h-2 w-2/3 rounded bg-line" />
        <div className="h-2 w-1/2 rounded bg-line" />
      </div>

      {/* Panel */}
      <div
        className="absolute flex flex-col overflow-hidden bg-surface"
        style={{
          [isRight ? 'right' : 'left']: '16px',
          bottom: '76px',
          width: '300px',
          height: '420px',
          borderRadius: '18px',
          boxShadow: '0 16px 40px -8px rgba(0,0,0,0.18)',
        }}
      >
        <div
          className="px-4 pt-3 pb-4"
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, ${rgba(brandColor, 0.85)} 100%)`,
            color: onBrand,
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: rgba('#ffffff', 0.22) }}
            >
              {agentAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agentAvatarUrl}
                  alt={agentName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Sparkles size={14} />
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
                style={{ backgroundColor: '#22c55e', borderColor: brandColor }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight truncate">{agentName}</p>
              <p className="text-[10px] opacity-80 truncate">{agentTagline}</p>
            </div>
          </div>
        </div>

        {collectLead ? (
          <div className="flex flex-1 flex-col gap-3 px-5 py-5 bg-surface">
            <p className="text-xs font-semibold text-ink">Before we start</p>
            <p className="text-[11px] text-ink-2 -mt-2">
              Tell us a bit about yourself.
            </p>
            <div className="h-9 rounded-xl border border-line bg-surface shadow-card" />
            <div className="h-9 rounded-xl border border-line bg-surface shadow-card" />
            <div
              className="mt-auto flex h-9 items-center justify-center rounded-lg text-xs font-semibold"
              style={{ backgroundColor: brandColor, color: onBrand }}
            >
              Start chatting
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 px-3 py-3" style={{ background: '#f7f8fa' }}>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink shadow-sm">
                  {welcomeMessage}
                </div>
              </div>
              <div className="flex justify-end">
                <div
                  className="max-w-[70%] rounded-2xl rounded-br-md px-3 py-2 text-[11px] leading-relaxed shadow-sm"
                  style={{ backgroundColor: brandColor, color: onBrand }}
                >
                  Hi, do you ship internationally?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink shadow-sm">
                  Yes, we ship to over 40 countries. Where would you like it sent?
                </div>
              </div>
            </div>
            <div className="border-t border-line bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-1.5">
                <span className="flex-1 text-[11px] text-ink-3">Type a message…</span>
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: brandColor, color: onBrand }}
                >
                  <Send size={10} strokeWidth={2.5} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Launcher */}
      <button
        type="button"
        className="absolute flex h-12 w-12 items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-105"
        style={{
          [isRight ? 'right' : 'left']: '16px',
          bottom: '16px',
          backgroundColor: brandColor,
          color: onBrand,
          boxShadow: `0 12px 28px -8px ${rgba(brandColor, 0.55)}`,
        }}
        aria-label="Preview launcher"
      >
        {agentAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agentAvatarUrl} alt={agentName} className="h-full w-full object-cover" />
        ) : (
          <Sparkles size={18} strokeWidth={2.2} />
        )}
      </button>
    </div>
  )
}
