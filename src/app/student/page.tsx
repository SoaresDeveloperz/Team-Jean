import { redirect } from 'next/navigation'

export default function StudentFallbackPage() {
  redirect('/student/today')
}
