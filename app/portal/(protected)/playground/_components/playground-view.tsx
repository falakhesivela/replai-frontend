'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Loader2, RotateCcw, Send, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { playgroundChat, PortalAuthError, type TokenGetter } from '@/lib/api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ message, time }: { message: ChatMessage; time: Date }) {
  const isAssistant = message.role === 'assistant'
  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[72%] flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isAssistant
              ? 'rounded-tl-sm bg-white border border-gray-200 text-gray-800'
              : 'rounded-tr-sm bg-[#dcf8c6] text-gray-800'
          }`}
        >
          {message.content}
        </div>
        <span className="mt-1 px-1 text-[11px] text-gray-400">{formatTime(time)}</span>
      </div>
    </div>
  )
}

export default function PlaygroundView({ agentName }: { agentName: string }) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [times, setTimes] = useState<Date[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const getFreshToken = useCallback<TokenGetter>(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setTimes((prev) => [...prev, new Date()])
    setInput('')
    setSending(true)

    try {
      const { reply } = await playgroundChat(getFreshToken, text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      setTimes((prev) => [...prev, new Date()])
    } catch (err) {
      if (err instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
      setTimes((prev) => [...prev, new Date()])
    } finally {
      setSending(false)
    }
  }, [input, sending, messages, getFreshToken, router])

  const reset = useCallback(() => {
    setMessages([])
    setTimes([])
    setInput('')
  }, [])

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-3rem)] gap-0 overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Agent Playground</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Test how your AI responds — no real messages are sent
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={13} />
            Reset chat
          </button>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Phone mockup column (hidden on small screens) */}
          <div className="hidden lg:flex flex-col items-center justify-center w-80 shrink-0 bg-gray-50 border-r border-gray-100 p-8">
            <div className="relative">
              <div className="w-64 h-[540px] rounded-[2.5rem] border-[8px] border-gray-800 bg-[#e5ddd5] shadow-2xl overflow-hidden flex flex-col">
                {/* WhatsApp-style top bar */}
                <div className="shrink-0 bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{agentName}</p>
                    <p className="text-[10px] text-white/70">online</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
                  {messages.length === 0 && (
                    <div className="flex justify-center mt-8">
                      <span className="text-[10px] text-gray-500 bg-white/70 rounded-full px-3 py-1">
                        Send a message to start
                      </span>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isAssistant = msg.role === 'assistant'
                    return (
                      <div key={i} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap ${
                            isAssistant
                              ? 'rounded-tl-sm bg-white text-gray-800'
                              : 'rounded-tr-sm bg-[#dcf8c6] text-gray-800'
                          }`}
                        >
                          {msg.content}
                          <span className="block text-[9px] text-gray-400 text-right mt-0.5">
                            {times[i] ? formatTime(times[i]) : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-white rounded-xl rounded-tl-sm px-2.5 py-1.5 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="shrink-0 bg-[#f0f0f0] px-2 py-2 flex items-center gap-1.5">
                  <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-gray-400">
                    {input || 'Type a message…'}
                  </div>
                  <div className="h-7 w-7 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <Send size={12} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Phone notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-gray-700" />

              <div className="flex items-center gap-1.5 mt-4 justify-center text-xs text-gray-400">
                <Smartphone size={13} />
                WhatsApp preview
              </div>
            </div>
          </div>

          {/* Main chat panel */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto bg-[#e5ddd5] px-4 md:px-8 py-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center max-w-xs">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-white/60 flex items-center justify-center">
                      <Bot size={22} strokeWidth={1.5} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">Start a test conversation</p>
                    <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                      Send a message to see how <strong>{agentName}</strong> would respond on WhatsApp.
                      Nothing is saved or sent to real customers.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} time={times[i] ?? new Date()} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-3.5 py-2.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage()
                    }
                  }}
                  placeholder="Type a test message… (Enter to send)"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white transition-colors hover:bg-[#20c45c] disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} strokeWidth={2} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Sandbox mode — uses your live system prompt and knowledge base. Changes to settings take effect immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
