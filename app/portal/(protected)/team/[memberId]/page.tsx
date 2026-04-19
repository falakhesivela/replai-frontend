import { TeamMemberDetailPage } from './_components/team-member-detail-page'

export default async function TeamMemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params
  return <TeamMemberDetailPage memberId={memberId} />
}
