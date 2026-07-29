'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  FlaskConical,
  PartyPopper,
  Rocket,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyOnboarding, patchMyOnboarding, type TokenGetter } from '@/lib/api'
import type { OnboardingStatus } from '@/lib/types'
import { Badge, Button, buttonClasses, Card, PageHeader } from '@/components/ui'
import { useToast } from '@/components/toast'
import WhatsAppEmbeddedSignup, {
  whatsappEmbeddedSignupConfigured,
} from '@/components/whatsapp-embedded-signup'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type StepKey = 'profile' | 'knowledge' | 'test' | 'go_live' | 'power_ups'

interface StepDef {
  key: StepKey
  title: string
  description: string
  icon: LucideIcon
  cta: { label: string; href: string }
  /** Secondary action shown alongside the CTA. */
  altCta?: { label: string; href: string }
  skippable: boolean
}

const EMPTY_STATUS: OnboardingStatus = {
  steps: {
    profile: { done: false, skipped: false },
    knowledge: { done: false, skipped: false },
    test: { done: false, skipped: false },
    go_live: { done: false, skipped: false },
    power_ups: { done: false, skipped: false },
  },
  completed_at: null,
}

export default function OnboardingView({
  initialStatus,
  hasWidget,
}: {
  initialStatus: OnboardingStatus | null
  hasWidget: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [status, setStatus] = useState<OnboardingStatus>(
    initialStatus ?? EMPTY_STATUS
  )
  const [busy, setBusy] = useState<string | null>(null)

  const steps: StepDef[] = [
    {
      key: 'profile',
      title: 'Set up your agent',
      description:
        'Give your AI agent a personality: pick an industry template or write your own instructions, set the tone and name.',
      icon: Bot,
      cta: { label: 'Configure agent', href: '/portal/my-agent' },
      skippable: false,
    },
    {
      key: 'knowledge',
      title: 'Teach it your business',
      description:
        'Upload an FAQ or price list, or point it at your website — the agent answers from what it learns here.',
      icon: BookOpen,
      cta: { label: 'Add knowledge', href: '/portal/knowledge-base' },
      skippable: true,
    },
    {
      key: 'test',
      title: 'Send a test message',
      description:
        'Chat with your agent in the playground. This step completes automatically after your first test conversation.',
      icon: FlaskConical,
      cta: { label: 'Open playground', href: '/portal/playground' },
      skippable: true,
    },
    {
      key: 'go_live',
      title: 'Go live',
      description:
        (hasWidget
          ? 'Connect your WhatsApp number, or install the chat widget on your website with a copy-paste snippet. '
          : 'Connect your WhatsApp number so customers can start chatting with your agent. ') +
        'Already use the WhatsApp Business app on your phone? Keep it — Replai connects alongside it.',
      icon: Rocket,
      cta: { label: 'Connect WhatsApp', href: '/portal/settings' },
      altCta: hasWidget
        ? { label: 'Install website widget', href: '/portal/chatbot-widget' }
        : undefined,
      skippable: true,
    },
    {
      key: 'power_ups',
      title: 'Add power-ups',
      description:
        'Optional modules: bookings & reminders, product catalogue & orders, WhatsApp broadcast campaigns.',
      icon: Sparkles,
      cta: { label: 'Browse add-ons', href: '/portal/subscription' },
      skippable: true,
    },
  ]

  const stepState = (key: StepKey) => status.steps[key] ?? { done: false, skipped: false }
  const isResolved = (key: StepKey) => stepState(key).done || stepState(key).skipped
  const doneCount = steps.filter((s) => isResolved(s.key)).length
  const allResolved = doneCount === steps.length
  const complete = Boolean(status.completed_at)

  // First unresolved step gets the "current" highlight.
  const currentKey = steps.find((s) => !isResolved(s.key))?.key ?? null

  async function skip(key: StepKey) {
    setBusy(key)
    try {
      const next =
        key === 'power_ups'
          ? await patchMyOnboarding(getFreshToken, { power_ups_done: true })
          : await patchMyOnboarding(getFreshToken, { skips: { [key]: true } })
      setStatus(next)
    } catch {
      toast.error('Could not save. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function finish() {
    setBusy('finish')
    try {
      const next = await patchMyOnboarding(getFreshToken, {
        complete: true,
        power_ups_done: true,
      })
      setStatus(next)
      router.refresh()
    } catch {
      toast.error('Could not save. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (complete) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="text-center">
          <PartyPopper size={32} strokeWidth={1.5} className="mx-auto text-accent-text" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
            You&apos;re all set
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Your agent is configured. Watch how it performs from your new
            analytics dashboard.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/portal/analytics" className={buttonClasses()}>
              View analytics <ArrowRight size={14} />
            </Link>
            <Link
              href="/portal/overview"
              className={buttonClasses({ variant: 'secondary' })}
            >
              Go to overview
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Get set up"
        description={`${doneCount} of ${steps.length} steps complete — your agent goes live in minutes.`}
      />

      {/* Progress bar */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const st = stepState(step.key)
          const resolved = st.done || st.skipped
          const isCurrent = step.key === currentKey
          const Icon = step.icon

          return (
            <Card
              key={step.key}
              padding="sm"
              className={
                isCurrent ? 'border-accent/40 shadow-glow-accent' : undefined
              }
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
                    st.done
                      ? 'bg-success-soft ring-success/25'
                      : 'bg-accent-soft ring-accent/15'
                  }`}
                >
                  {st.done ? (
                    <CheckCircle2 size={17} strokeWidth={1.75} className="text-success" />
                  ) : (
                    <Icon size={17} strokeWidth={1.75} className="text-accent-text" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        resolved && !st.done ? 'text-ink-3' : 'text-ink'
                      }`}
                    >
                      {step.title}
                    </p>
                    {st.done && <Badge tone="success">Done</Badge>}
                    {!st.done && st.skipped && <Badge>Skipped</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">
                    {step.description}
                  </p>
                  {!st.done && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {step.key === 'go_live' && whatsappEmbeddedSignupConfigured ? (
                        // Connect right here — no detour through Settings.
                        <WhatsAppEmbeddedSignup
                          variant={isCurrent ? 'primary' : 'secondary'}
                          onConnected={async (connStatus) => {
                            if (connStatus.registration_warning) {
                              toast.error(connStatus.registration_warning)
                            } else {
                              toast.success('WhatsApp connected — you are live!')
                            }
                            try {
                              setStatus(await getMyOnboarding(getFreshToken))
                            } catch {
                              /* step state refreshes on next visit */
                            }
                            router.refresh()
                          }}
                          onError={(message) => toast.error(message)}
                        />
                      ) : (
                        <Link
                          href={step.cta.href}
                          className={buttonClasses({
                            variant: isCurrent ? 'primary' : 'secondary',
                            size: 'sm',
                          })}
                        >
                          {step.cta.label} <ArrowRight size={12} />
                        </Link>
                      )}
                      {step.altCta && (
                        <Link
                          href={step.altCta.href}
                          className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                        >
                          {step.altCta.label}
                        </Link>
                      )}
                      {step.skippable && !st.skipped && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === step.key}
                          onClick={() => skip(step.key)}
                        >
                          Skip for now
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {!resolved && !isCurrent && (
                  <Circle size={14} className="mt-1 shrink-0 text-ink-3/40" />
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {allResolved && (
        <div className="mt-6 flex justify-end">
          <Button onClick={finish} disabled={busy === 'finish'}>
            Finish setup <ArrowRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
