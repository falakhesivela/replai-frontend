'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Minus,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  sendWidgetMessage,
  streamWidgetMessage,
  startWidgetConversation,
  uploadWidgetAttachment,
  type WidgetAction,
  type WidgetAttachment,
  type WidgetComponent,
  type WidgetReplyPayload,
} from '@/lib/api'
import {
  bookingActionUserLabel,
  inlineBookingComponents,
  WidgetBookingMessageComponents,
  type BookingConfirmationData,
} from './widget-booking'
import {
  ConfirmationEmailModal,
  isValidConfirmationEmail,
} from './widget-confirmation-email'
import {
  addProductToLocalCart,
  cartStorageKey,
  loadStoredCart,
  saveStoredCart,
} from './widget-client-cart'
import {
  actionToWidgetAction,
  actionUserLabel,
  extractCartFromComponents,
  inlineShoppingComponents,
  StickyCartBar,
  WidgetMessageComponents,
  type CartSummaryData,
} from './widget-shopping'
import type { WidgetProductGridItem } from '@/lib/api'
import type { WidgetConfig } from '@/lib/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: WidgetAttachment[]
  components?: WidgetComponent[]
  failed?: boolean
}

interface PendingAttachment {
  id: string
  file: File
  status: 'uploading' | 'ready' | 'error'
  uploaded?: WidgetAttachment
  error?: string
  previewUrl?: string
}

interface Props {
  widgetId: string
  config: WidgetConfig
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 5

const PRECHAT_DELAY_MS = 2500
const MOBILE_BREAKPOINT = 520

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// Hex → readable RGB. Falls back to brand-ish purple if parsing fails.
function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [99, 102, 241]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// WCAG-ish luminance — used to pick text color over the brand surface.
function isColorDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum < 0.6
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

// Host → widget layout messages. Lets a loader script tell the widget whether
// the embedding page is on a small viewport so we can render fullscreen even
// when the iframe itself was sized small.
function useHostLayout(): { mobile: boolean | null } {
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object' || d.source !== 'replai-host') return
      if (d.type === 'layout' && typeof d.mobile === 'boolean') setMobile(d.mobile)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  return { mobile }
}

// Widget → host signal. The loader resizes the iframe based on these events.
function postHost(type: string, extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || window.parent === window) return
  try {
    window.parent.postMessage(
      { source: 'replai-widget', type, ...extra },
      '*',
    )
  } catch {
    // Cross-origin parents can throw on some browsers — safe to ignore; the
    // widget still works inside its iframe, just without dynamic resizing.
  }
}

export default function WidgetChat({ widgetId, config }: Props) {
  const {
    welcome_message,
    brand_color,
    position,
    collect_lead,
    agent_name,
    agent_tagline,
    agent_avatar_url,
  } = config
  const isRight = position !== 'bottom-left'
  const onBrand = isColorDark(brand_color) ? '#ffffff' : '#111827'
  const agentName = agent_name || 'Support'
  const agentTagline = agent_tagline || 'Typically replies in seconds'

  const localIsMobile = useIsMobile()
  const { mobile: hostMobile } = useHostLayout()
  // Prefer the host's media query (sent by the loader script) over the iframe's
  // own viewport — a 420px-wide iframe is not "mobile" just because of its size.
  const isMobile = hostMobile ?? localIsMobile

  const [open, setOpen] = useState(false)
  const [showPrechat, setShowPrechat] = useState(false)

  // Lead form
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadSubmitted, setLeadSubmitted] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [emailPrompt, setEmailPrompt] = useState<
    null | { purpose: 'checkout' } | { purpose: 'booking'; comp: BookingConfirmationData }
  >(null)

  // Chat
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [times, setTimes] = useState<Date[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // Partial assistant text while an SSE reply streams in (null = not streaming).
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRetry, setPendingRetry] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [activeCart, setActiveCart] = useState<CartSummaryData | null>(null)
  const [cartToast, setCartToast] = useState<string | null>(null)
  const clientCartActiveRef = useRef(false)
  const activeCartRef = useRef<CartSummaryData | null>(null)
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sessionKeys = useMemo(
    () => ({
      conv: `widget_conv_${widgetId}`,
      prechat: `widget_prechat_dismissed_${widgetId}`,
    }),
    [widgetId],
  )

  // Restore conversation across navigation within the same tab.
  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKeys.conv)
    if (stored) {
      setConversationId(stored)
      setLeadSubmitted(true)
    }
  }, [sessionKeys.conv])

  // Restore client cart for this conversation (instant re-add after refresh).
  useEffect(() => {
    if (!conversationId) return
    const stored = loadStoredCart(cartStorageKey(widgetId, conversationId))
    if (stored?.items.length) {
      clientCartActiveRef.current = true
      setActiveCart(stored)
    }
  }, [conversationId, widgetId])

  useEffect(() => {
    activeCartRef.current = activeCart
  }, [activeCart])

  useEffect(() => {
    if (leadEmail.trim()) setConfirmationEmail(leadEmail.trim())
  }, [leadEmail])

  useEffect(() => {
    if (!conversationId) return
    saveStoredCart(cartStorageKey(widgetId, conversationId), activeCart)
  }, [activeCart, conversationId, widgetId])

  useEffect(() => {
    return () => {
      if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
    }
  }, [])

  // Pre-chat teaser: shows once per session if the visitor hasn't opened the widget.
  useEffect(() => {
    if (open) {
      setShowPrechat(false)
      return
    }
    if (sessionStorage.getItem(sessionKeys.prechat)) return
    const t = window.setTimeout(() => setShowPrechat(true), PRECHAT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [open, sessionKeys.prechat])

  // Auto-scroll on new content. Only when the panel is visible.
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, open, leadSubmitted, activeCart])

  // Auto-resize textarea up to a cap so it doesn't eat the panel.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Focus the input when chat opens (post-lead-form).
  useEffect(() => {
    if (open && leadSubmitted) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 250)
      return () => window.clearTimeout(t)
    }
  }, [open, leadSubmitted])

  // Revoke any leftover object URLs when the widget unmounts so we don't leak.
  useEffect(() => {
    return () => {
      setPending((prev) => {
        prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
        return prev
      })
    }
  }, [])

  // Tell the host loader our current visual state so it can size the iframe.
  // The launcher needs ~96×96; the prechat bubble needs ~360×120; the open
  // panel needs 420×720 (desktop) or fullscreen (mobile).
  useEffect(() => {
    postHost('ready', { side: isRight ? 'right' : 'left' })
  }, [isRight])

  // Track the previous "opened" state so we can defer the shrink message until
  // the panel's 200ms exit animation completes. Otherwise the host iframe
  // resizes instantly and clips the panel mid-transition.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    const side = isRight ? 'right' : 'left'
    if (open) {
      postHost('opened', { side })
      wasOpenRef.current = true
      return
    }
    const next = showPrechat ? 'prechat' : 'closed'
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      const t = window.setTimeout(() => postHost(next, { side }), 220)
      return () => window.clearTimeout(t)
    }
    postHost(next, { side })
  }, [open, showPrechat, isRight])

  function dismissPrechat() {
    setShowPrechat(false)
    sessionStorage.setItem(sessionKeys.prechat, '1')
  }

  function openFromPrechat() {
    dismissPrechat()
    setOpen(true)
  }

  async function startConversation(visitor?: { name: string; email: string }) {
    const { conversation_id } = await startWidgetConversation(widgetId, visitor)
    sessionStorage.setItem(sessionKeys.conv, conversation_id)
    setConversationId(conversation_id)
    if (welcome_message) {
      // Only seed the greeting when the thread is still empty. Conversations are
      // created lazily on first send, so by the time this runs the visitor's
      // message may already be in `messages` — replacing it would drop it.
      setMessages((prev) =>
        prev.length === 0 ? [{ role: 'assistant', content: welcome_message }] : prev,
      )
      setTimes((prev) => (prev.length === 0 ? [new Date()] : prev))
    }
    return conversation_id
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await startConversation({ name: leadName.trim(), email: leadEmail.trim() })
      setLeadSubmitted(true)
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function ensureConversation(): Promise<string | null> {
    if (conversationId) return conversationId
    try {
      const cid = await startConversation()
      setLeadSubmitted(true)
      return cid
    } catch {
      setError('Could not start chat. Please try again.')
      return null
    }
  }

  async function handleFilesPicked(files: File[]) {
    if (!files.length) return
    const room = MAX_ATTACHMENTS - pending.length
    if (room <= 0) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`)
      return
    }
    const accepted = files.slice(0, room)

    // Lazily create the conversation so the upload endpoint has a parent.
    const cid = await ensureConversation()
    if (!cid) return

    for (const file of accepted) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} exceeds the 10 MB limit.`)
        continue
      }
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined
      setPending((prev) => [
        ...prev,
        { id, file, status: 'uploading', previewUrl },
      ])

      uploadWidgetAttachment(widgetId, cid, file)
        .then((uploaded) => {
          setPending((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: 'ready', uploaded } : p)),
          )
        })
        .catch((err: unknown) => {
          setPending((prev) =>
            prev.map((p) =>
              p.id === id
                ? { ...p, status: 'error', error: String(err) }
                : p,
            ),
          )
        })
    }
  }

  function removePending(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const showCartToast = useCallback((text: string) => {
    setCartToast(text)
    if (cartToastTimerRef.current) clearTimeout(cartToastTimerRef.current)
    cartToastTimerRef.current = setTimeout(() => setCartToast(null), 2000)
  }, [])

  const addToCartLocal = useCallback(
    (product: WidgetProductGridItem) => {
      if (!product.in_stock) return
      clientCartActiveRef.current = true
      setActiveCart((prev) => addProductToLocalCart(prev, product, 1))
      showCartToast(`Added ${product.name}`)
    },
    [showCartToast],
  )

  const applyAssistantResponse = useCallback((data: WidgetReplyPayload) => {
    const cart = extractCartFromComponents(data.components)
    const placed = data.components?.some((c) => c.type === 'payment_cta')
    if (placed) {
      clientCartActiveRef.current = false
      setActiveCart(null)
      if (conversationId) {
        saveStoredCart(cartStorageKey(widgetId, conversationId), null)
      }
    } else if (cart && cart.items.length > 0) {
      setActiveCart(cart)
      clientCartActiveRef.current = true
    }

    const inline = [
      ...inlineShoppingComponents(data.components),
      ...inlineBookingComponents(data.components),
    ]
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: data.reply,
        components: inline.length ? inline : undefined,
      },
    ])
    setTimes((prev) => [...prev, new Date()])
  }, [conversationId, widgetId])

  const bookingsEnabled = config.features?.bookings === true

  const viewLocalCart = useCallback(() => {
    const cart = activeCartRef.current
    if (!cart?.items.length) return
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'View cart' },
      {
        role: 'assistant',
        content: "Here's your cart:",
        components: [{ ...cart }],
      },
    ])
    setTimes((prev) => [...prev, new Date(), new Date()])
  }, [])

  const resolveConfirmationEmail = useCallback(
    (override?: string) => {
      const candidate = (override ?? confirmationEmail ?? leadEmail).trim()
      return isValidConfirmationEmail(candidate) ? candidate : null
    },
    [confirmationEmail, leadEmail],
  )

  const sendWidgetAction = useCallback(
    async (
      action: WidgetAction,
      contextLabel?: string,
      emailOverride?: string,
    ) => {
      if (sending) return

      if (action.type === 'view_cart') {
        viewLocalCart()
        return
      }

      let actionPayload: WidgetAction = action
      if (action.type === 'checkout') {
        const cart = activeCartRef.current
        if (!cart?.items.length) {
          setMessages((prev) => [
            ...prev,
            { role: 'user', content: contextLabel || 'Checkout' },
            {
              role: 'assistant',
              content:
                'Your cart is empty. Tap Add on a product first, then checkout.',
            },
          ])
          setTimes((prev) => [...prev, new Date(), new Date()])
          return
        }
        if (!action.items?.length) {
          actionPayload = {
            type: 'checkout',
            items: cart.items.map((i) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
          }
        }
      }

      const email = resolveConfirmationEmail(emailOverride)
      if (actionPayload.type === 'checkout' && !email) {
        setEmailPrompt({ purpose: 'checkout' })
        return
      }

      if (email) {
        setConfirmationEmail(email)
        if (actionPayload.type === 'checkout') {
          actionPayload = { ...actionPayload, customer_email: email }
        }
        if (actionPayload.type === 'confirm_booking') {
          actionPayload = { ...actionPayload, customer_email: email }
        }
      }

      const label =
        actionUserLabel(actionPayload, contextLabel) ||
        bookingActionUserLabel(actionPayload, contextLabel)
      setMessages((prev) => [...prev, { role: 'user', content: label }])
      setTimes((prev) => [...prev, new Date()])

      setSending(true)
      setError(null)
      setPendingRetry(null)

      const visitorName = leadName.trim() || undefined
      if (
        actionPayload.type === 'confirm_booking' &&
        visitorName &&
        !actionPayload.customer_name
      ) {
        actionPayload = { ...actionPayload, customer_name: visitorName }
      }

      try {
        let convId = conversationId
        if (!convId) {
          convId = await startConversation(
            email ? { name: visitorName || 'Guest', email } : undefined,
          )
          setLeadSubmitted(true)
        }
        const checkoutItems =
          actionPayload.type === 'checkout' && actionPayload.items?.length
            ? actionPayload.items
            : undefined

        const data = await sendWidgetMessage(
          widgetId,
          convId,
          '',
          [],
          actionPayload,
          {
            visitor_name: visitorName,
            visitor_email: email ?? undefined,
            checkout_items: checkoutItems,
          },
        )
        applyAssistantResponse(data)
      } catch {
        setMessages((prev) => {
          const copy = [...prev]
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'user' && !copy[i].failed) {
              copy[i] = { ...copy[i], failed: true }
              break
            }
          }
          return copy
        })
        setError('Action failed. Please try again.')
      } finally {
        setSending(false)
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sending,
      conversationId,
      widgetId,
      applyAssistantResponse,
      leadName,
      viewLocalCart,
      resolveConfirmationEmail,
    ],
  )

  const checkoutCart = useCallback(() => {
    if (!activeCart?.items.length || sending) return
    void sendWidgetAction(
      {
        type: 'checkout',
        items: activeCart.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      },
      'Checkout',
    )
  }, [activeCart, sending, sendWidgetAction])

  const submitBookingDetails = useCallback(
    (
      comp: import('./widget-booking').BookingIntakeFormData,
      details: Record<string, string | number>,
    ) => {
      const bookingDetails = { ...details }
      if (comp.check_out) bookingDetails.check_out = comp.check_out
      void sendWidgetAction(
        {
          type: 'submit_booking_details',
          service_id: comp.service_id,
          date: comp.date,
          time: comp.time,
          booking_details: bookingDetails,
        },
        'Continue booking',
      )
    },
    [sendWidgetAction],
  )

  const confirmBooking = useCallback(
    (comp: BookingConfirmationData, emailOverride?: string) => {
      const email = resolveConfirmationEmail(emailOverride)
      if (!email) {
        setEmailPrompt({ purpose: 'booking', comp })
        return
      }
      const bookingDetails = { ...(comp.booking_details ?? {}) }
      if (comp.check_out) bookingDetails.check_out = comp.check_out
      void sendWidgetAction(
        {
          type: 'confirm_booking',
          service_id: comp.service_id,
          date: comp.date,
          time: comp.time,
          customer_name: leadName.trim() || undefined,
          booking_details: Object.keys(bookingDetails).length ? bookingDetails : undefined,
        },
        'Confirm booking',
        email,
      )
    },
    [sendWidgetAction, leadName, resolveConfirmationEmail],
  )

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim()
      const ready = pending
        .filter((p) => p.status === 'ready' && p.uploaded)
        .map((p) => p.uploaded as WidgetAttachment)
      const stillUploading = pending.some((p) => p.status === 'uploading')

      if (sending || stillUploading) return
      if (!text && !ready.length) return

      // First message in a not-yet-created conversation: keep the greeting
      // visible by promoting it from the placeholder bubble to a real message
      // ahead of the user's, instead of letting startConversation seed it later.
      setMessages((prev) => {
        const greeting: ChatMessage[] =
          prev.length === 0 && welcome_message
            ? [{ role: 'assistant', content: welcome_message }]
            : []
        return [
          ...prev,
          ...greeting,
          { role: 'user', content: text, attachments: ready.length ? ready : undefined },
        ]
      })
      setTimes((prev) => {
        const greeting = prev.length === 0 && welcome_message ? [new Date()] : []
        return [...prev, ...greeting, new Date()]
      })
      if (!textOverride) setInput('')

      // Send is gated on no uploads in flight, so clearing is safe.
      // Revoke every pending blob URL on the way out.
      setPending((prev) => {
        prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
        return []
      })

      setSending(true)
      setError(null)
      setPendingRetry(null)

      try {
        let convId = conversationId
        if (!convId) {
          convId = await startConversation()
          setLeadSubmitted(true)
        }
        try {
          setStreamingMessage('')
          const data = await streamWidgetMessage(widgetId, convId, text, ready, {
            onDelta: (t) => setStreamingMessage((prev) => (prev ?? '') + t),
            onReset: () => setStreamingMessage(''),
          })
          setStreamingMessage(null)
          applyAssistantResponse(data)
        } catch {
          // Streaming failed (transport/SSE) — fall back to the JSON endpoint once.
          setStreamingMessage(null)
          const data = await sendWidgetMessage(widgetId, convId, text, ready)
          applyAssistantResponse(data)
        }
      } catch {
        // Mark the user message as failed so they can retry it. Attachments
        // aren't retried (they're already uploaded — only the message send failed).
        setMessages((prev) => {
          const copy = [...prev]
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'user' && !copy[i].failed) {
              copy[i] = { ...copy[i], failed: true }
              break
            }
          }
          return copy
        })
        setPendingRetry(text)
        setError('Message failed to send.')
      } finally {
        setSending(false)
        setStreamingMessage(null)
      }
    },
    // startConversation is stable-by-closure for this component lifetime; deps cover the inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, sending, conversationId, widgetId, welcome_message, pending, applyAssistantResponse],
  )

  function handleRetry() {
    if (!pendingRetry) return
    // Strip the failed user bubble; sendMessage will re-add it.
    setMessages((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'user' && copy[i].failed) {
          copy.splice(i, 1)
          setTimes((t) => {
            const tCopy = [...t]
            tCopy.splice(i, 1)
            return tCopy
          })
          break
        }
      }
      return copy
    })
    void sendMessage(pendingRetry)
  }

  const showLeadForm = collect_lead && !leadSubmitted

  // Position rules. On mobile we go fullscreen; on desktop we anchor to the side.
  const sideOffset: React.CSSProperties = isMobile
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : isRight
      ? { right: '20px' }
      : { left: '20px' }

  const panelStyle: React.CSSProperties = isMobile
    ? {
        ...sideOffset,
        width: '100vw',
        height: '100dvh',
        borderRadius: 0,
        pointerEvents: 'auto',
      }
    : {
        ...sideOffset,
        bottom: '88px',
        width: '380px',
        height: '600px',
        maxHeight: 'calc(100dvh - 120px)',
        pointerEvents: 'auto',
      }

  const launcherStyle: React.CSSProperties = {
    ...(isRight ? { right: '20px' } : { left: '20px' }),
    bottom: '20px',
    backgroundColor: brand_color,
    boxShadow: `0 12px 32px -8px ${rgba(brand_color, 0.55)}, 0 4px 12px rgba(0,0,0,0.12)`,
    pointerEvents: 'auto',
  }

  const prechatStyle: React.CSSProperties = {
    ...(isRight ? { right: '88px' } : { left: '88px' }),
    bottom: '32px',
    pointerEvents: 'auto',
  }

  return (
    <div className="fixed inset-0" style={{ pointerEvents: 'none' }}>
      {/* Pre-chat teaser bubble — desktop only, before first open */}
      {!isMobile && !open && showPrechat && welcome_message && (
        <div
          className="absolute flex items-end gap-2 animate-[wfade_240ms_ease-out]"
          style={prechatStyle}
        >
          <div className="relative max-w-[260px] rounded-2xl rounded-br-sm bg-white px-3.5 py-2.5 text-sm leading-snug text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <button
              type="button"
              onClick={dismissPrechat}
              aria-label="Dismiss"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-gray-700"
            >
              <X size={11} />
            </button>
            <p className="line-clamp-3 cursor-pointer" onClick={openFromPrechat}>
              {welcome_message}
            </p>
          </div>
        </div>
      )}

      {/* Chat panel */}
      <div
        className={`absolute flex flex-col overflow-hidden bg-white transition-all duration-200 ease-out ${
          open
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-2 scale-[0.98] pointer-events-none'
        }`}
        style={{
          ...panelStyle,
          borderRadius: isMobile ? 0 : '20px',
          boxShadow: isMobile
            ? 'none'
            : '0 24px 64px -12px rgba(0,0,0,0.25), 0 8px 24px -8px rgba(0,0,0,0.1)',
          transformOrigin: isRight ? 'bottom right' : 'bottom left',
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden={!open}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
        <ConfirmationEmailModal
          open={emailPrompt !== null}
          purpose={emailPrompt?.purpose ?? 'checkout'}
          initialEmail={confirmationEmail || leadEmail}
          brandColor={brand_color}
          onBrand={onBrand}
          busy={sending}
          onCancel={() => setEmailPrompt(null)}
          onSubmit={(email) => {
            setConfirmationEmail(email)
            const pending = emailPrompt
            setEmailPrompt(null)
            if (pending?.purpose === 'checkout') {
              void sendWidgetAction(
                {
                  type: 'checkout',
                  items: activeCart?.items.map((i) => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                  })),
                  customer_email: email,
                },
                'Checkout',
                email,
              )
            } else if (pending?.purpose === 'booking') {
              confirmBooking(pending.comp, email)
            }
          }}
        />
        {/* Header */}
        <div
          className="relative shrink-0 px-4 pt-4 pb-5"
          style={{
            background: `linear-gradient(135deg, ${brand_color} 0%, ${rgba(
              brand_color,
              0.85,
            )} 100%)`,
            color: onBrand,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-base font-semibold backdrop-blur-sm"
                  style={{ backgroundColor: rgba('#ffffff', 0.22) }}
                >
                  {agent_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={agent_avatar_url}
                      alt={agentName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2"
                  style={{ backgroundColor: '#22c55e', borderColor: brand_color }}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{agentName}</p>
                <p className="truncate text-xs opacity-80">{agentTagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Minimize"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15"
              >
                <Minus size={16} />
              </button>
            </div>
          </div>
        </div>

        {showLeadForm ? (
          <form
            onSubmit={handleLeadSubmit}
            className="flex flex-1 flex-col px-6 py-6 gap-5 overflow-y-auto"
          >
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900">Before we start</h3>
              <p className="text-sm text-gray-500">
                Tell us a bit about yourself so we can follow up if we get disconnected.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Your name</span>
                <input
                  required
                  type="text"
                  placeholder="Jane Doe"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Email address</span>
                <input
                  required
                  type="email"
                  placeholder="jane@example.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none"
                />
              </label>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ backgroundColor: brand_color, color: onBrand }}
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              Start chatting
            </button>

            <p className="text-center text-[11px] text-gray-400">
              By continuing you agree to our terms.
            </p>
          </form>
        ) : (
          <>
            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-5 space-y-1 min-h-0"
              style={{ background: '#f7f8fa' }}
            >
              {messages.length === 0 && !sending && welcome_message && (
                <MessageBubble
                  role="assistant"
                  content={welcome_message}
                  time={null}
                  brandColor={brand_color}
                  onBrand={onBrand}
                  showTail
                />
              )}

              {messages.map((msg, i) => {
                const prev = messages[i - 1]
                const next = messages[i + 1]
                const groupedAbove = prev?.role === msg.role
                const groupedBelow = next?.role === msg.role
                const showTail = !groupedBelow
                return (
                  <div key={i}>
                    <MessageBubble
                      role={msg.role}
                      content={msg.content}
                      attachments={msg.attachments}
                      time={times[i] && !groupedBelow ? formatTime(times[i]) : null}
                      brandColor={brand_color}
                      onBrand={onBrand}
                      showTail={showTail}
                      grouped={groupedAbove}
                      failed={msg.failed}
                    />
                    {msg.role === 'assistant' &&
                      msg.components &&
                      msg.components.length > 0 &&
                      !msg.failed && (
                        <>
                        <WidgetMessageComponents
                          components={msg.components}
                          brandColor={brand_color}
                          onBrand={onBrand}
                          disabled={sending}
                          addDisabled={false}
                          hasStickyCart={!!activeCart}
                          onAddProduct={(id, name) => {
                            const grids = msg.components?.filter(
                              (c) => c.type === 'product_grid',
                            )
                            const product = grids
                              ?.flatMap((g) =>
                                g.type === 'product_grid' ? g.products : [],
                              )
                              .find((p) => p.id === id)
                            if (product) {
                              addToCartLocal(product)
                            } else {
                              addToCartLocal({
                                id,
                                name,
                                price: 0,
                                currency: 'ZAR',
                                in_stock: true,
                              })
                            }
                          }}
                          onActionId={(actionId, label) => {
                            if (actionId === 'checkout') {
                              checkoutCart()
                              return
                            }
                            if (actionId === 'view_cart') {
                              viewLocalCart()
                              return
                            }
                            const mapped = actionToWidgetAction(actionId)
                            if (mapped) void sendWidgetAction(mapped, label)
                          }}
                          onCheckoutCart={() => checkoutCart()}
                          checkoutBusy={sending}
                        />
                        <WidgetBookingMessageComponents
                          components={msg.components}
                          brandColor={brand_color}
                          onBrand={onBrand}
                          disabled={sending}
                          busy={sending}
                          onSelectService={(id, name) =>
                            void sendWidgetAction(
                              { type: 'select_service', service_id: id },
                              name,
                            )
                          }
                          onSelectDate={(comp, date) =>
                            void sendWidgetAction({
                              type: 'select_date',
                              service_id: comp.service_id,
                              date,
                              purpose: comp.purpose ?? 'appointment',
                              check_in:
                                comp.purpose === 'check_out' ? comp.check_in ?? undefined : undefined,
                            })
                          }
                          onSelectTime={(serviceId, date, time) =>
                            void sendWidgetAction({
                              type: 'select_time',
                              service_id: serviceId,
                              date,
                              time,
                            })
                          }
                          onSubmitBookingDetails={submitBookingDetails}
                          onConfirmBooking={confirmBooking}
                        />
                        </>
                      )}
                  </div>
                )
              })}

              {sending && streamingMessage ? (
                <MessageBubble
                  role="assistant"
                  content={streamingMessage}
                  time={null}
                  brandColor={brand_color}
                  onBrand={onBrand}
                  showTail
                />
              ) : sending ? (
                <div className="flex justify-start pt-1">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white border border-gray-100 px-3.5 py-2.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            {/* Error / retry banner */}
            {error && pendingRetry && (
              <div className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 flex items-center justify-between gap-2">
                <p className="text-xs text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            )}

            {cartToast && (
              <div className="shrink-0 border-t border-gray-100 bg-gray-900 px-4 py-2 text-center text-xs font-medium text-white">
                {cartToast}
              </div>
            )}

            {activeCart && activeCart.items.length > 0 && (
              <StickyCartBar
                cart={activeCart}
                brandColor={brand_color}
                onBrand={onBrand}
                disabled={false}
                busy={sending}
                onCheckout={() => checkoutCart()}
                onViewCart={() => viewLocalCart()}
              />
            )}

            {/* Input */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-3 pt-2.5 pb-3">
              {bookingsEnabled && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendWidgetAction({ type: 'browse_services' })}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <Calendar size={14} />
                  Book appointment
                </button>
              )}
              {/* Pending attachment chips */}
              {pending.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pending.map((p) => (
                    <PendingChip
                      key={p.id}
                      item={p}
                      onRemove={() => removePending(p.id)}
                    />
                  ))}
                </div>
              )}

              <div
                className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-2 py-1.5 transition-colors focus-within:border-gray-900 focus-within:bg-white"
                onClick={(e) => {
                  // Don't steal focus when clicking a button inside the row.
                  if ((e.target as HTMLElement).closest('button')) return
                  inputRef.current?.focus()
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    void handleFilesPicked(files)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending.length >= MAX_ATTACHMENTS}
                  aria-label="Attach files"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip size={16} />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={
                    sending ||
                    pending.some((p) => p.status === 'uploading') ||
                    (!input.trim() && !pending.some((p) => p.status === 'ready'))
                  }
                  aria-label="Send message"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:scale-105"
                  style={{ backgroundColor: brand_color, color: onBrand }}
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={13} strokeWidth={2.5} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-gray-400">
                Powered by Replai
              </p>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Floating launcher — hidden on mobile while open (fullscreen panel + header minimize) */}
      {!(isMobile && open) && (
      <button
        type="button"
        onClick={() => {
          dismissPrechat()
          setOpen((v) => !v)
        }}
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-expanded={open}
        className="absolute flex h-14 w-14 items-center justify-center overflow-hidden rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
        style={launcherStyle}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            open ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
          }`}
          style={{ color: onBrand }}
        >
          {agent_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent_avatar_url}
              alt={agentName}
              className="h-full w-full object-cover"
            />
          ) : (
            <MessageSquareText size={22} strokeWidth={2.2} />
          )}
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            open ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
          }`}
          style={{ color: onBrand }}
        >
          <X size={22} strokeWidth={2.2} />
        </span>
      </button>
      )}

      <style>{`
        @keyframes wfade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

interface BubbleProps {
  role: 'user' | 'assistant'
  content: string
  attachments?: WidgetAttachment[]
  time: string | null
  brandColor: string
  onBrand: string
  showTail: boolean
  grouped?: boolean
  failed?: boolean
}

function MessageBubble({
  role,
  content,
  attachments,
  time,
  brandColor,
  onBrand,
  showTail,
  grouped,
  failed,
}: BubbleProps) {
  const isAssistant = role === 'assistant'
  const tailClass = isAssistant
    ? showTail
      ? 'rounded-bl-md'
      : 'rounded-bl-2xl'
    : showTail
      ? 'rounded-br-md'
      : 'rounded-br-2xl'

  const hasText = content.trim().length > 0
  const hasAttachments = !!attachments?.length

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
      <div className={`max-w-[82%] flex flex-col ${isAssistant ? 'items-start' : 'items-end'} gap-1`}>
        {hasAttachments && (
          <AttachmentList
            attachments={attachments!}
            align={isAssistant ? 'start' : 'end'}
            brandColor={brandColor}
            onBrand={onBrand}
          />
        )}
        {hasText && (
          <div
            className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${tailClass} ${
              isAssistant
                ? 'bg-white border border-gray-100 text-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                : 'shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
            } ${failed ? 'opacity-60 ring-1 ring-red-200' : ''}`}
            style={
              !isAssistant
                ? { backgroundColor: brandColor, color: onBrand }
                : undefined
            }
          >
            {isAssistant ? (
              <MarkdownContent content={content} />
            ) : (
              <span className="whitespace-pre-wrap break-words">{content}</span>
            )}
          </div>
        )}
        {(time || failed) && (
          <span className={`px-1 text-[10px] ${failed ? 'text-red-500' : 'text-gray-400'}`}>
            {failed ? 'Not delivered' : time}
          </span>
        )}
      </div>
    </div>
  )
}

// Attachment display (rendered inside message bubbles)

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentList({
  attachments,
  align,
  brandColor,
  onBrand,
}: {
  attachments: WidgetAttachment[]
  align: 'start' | 'end'
  brandColor: string
  onBrand: string
}) {
  const images = attachments.filter((a) => isImageMime(a.mime_type))
  const files = attachments.filter((a) => !isImageMime(a.mime_type))

  return (
    <div className={`flex flex-col gap-1.5 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {images.map((img) => (
            <a
              key={img.url}
              href={img.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
              style={{ maxWidth: images.length > 1 ? '120px' : '220px' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="block h-auto w-full object-cover"
                style={{ maxHeight: '220px' }}
              />
            </a>
          ))}
        </div>
      )}
      {files.map((f) => (
        <a
          key={f.url}
          href={f.url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs no-underline shadow-sm transition-colors hover:bg-gray-50"
          style={{ maxWidth: '240px' }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: brandColor, color: onBrand }}
          >
            <FileText size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-gray-800">{f.name}</span>
            <span className="block text-[10px] text-gray-400">{formatBytes(f.size)}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

// Pending attachment chip (above the input while uploading)

function PendingChip({
  item,
  onRemove,
}: {
  item: PendingAttachment
  onRemove: () => void
}) {
  const isImage = item.file.type.startsWith('image/')
  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 pr-7 text-xs shadow-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-500">
        {isImage && item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon size={13} />
        ) : (
          <FileText size={13} />
        )}
      </span>
      <span className="min-w-0 max-w-[140px]">
        <span className="block truncate font-medium text-gray-700">{item.file.name}</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          {item.status === 'uploading' && (
            <>
              <Loader2 size={9} className="animate-spin" /> Uploading…
            </>
          )}
          {item.status === 'ready' && <>{formatBytes(item.file.size)}</>}
          {item.status === 'error' && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle size={9} /> Failed
            </span>
          )}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
      >
        <X size={10} />
      </button>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="widget-md break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:opacity-80"
              style={{ color: 'inherit' }}
            />
          ),
          code: ({ children, ...props }) => (
            <code
              {...props}
              className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800"
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-md bg-gray-100 p-2 text-[12px]">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="my-1 list-disc pl-5 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 list-decimal pl-5 space-y-0.5">{children}</ol>
          ),
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          h1: ({ children }) => <h3 className="my-1 text-sm font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="my-1 text-sm font-semibold">{children}</h3>,
          h3: ({ children }) => <h3 className="my-1 text-sm font-semibold">{children}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
