import { CommunityScreen } from '@/components/community/CommunityScreen'

export default function AdminCommunityPage() {
  // No computador o feed fica numa coluna central, como nas redes sociais.
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <CommunityScreen role="admin" />
    </div>
  )
}
