import { LinkTabs } from '@/components/ui'

const TABS = [
  { href: '/portal/team', label: 'Members' },
  { href: '/portal/team/roles', label: 'Roles' },
  { href: '/portal/team/departments', label: 'Departments' },
  { href: '/portal/team/activity', label: 'Activity' },
]

export default function TeamTabs() {
  return <LinkTabs items={TABS} className="mb-6" />
}
