import type { Metadata } from 'next'
import { RegisterForm } from './register-form'

export const metadata: Metadata = {
  title: 'Start your free trial — Replai',
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>
}) {
  const { plan, cycle } = await searchParams
  return <RegisterForm plan={plan} cycle={cycle} />
}
