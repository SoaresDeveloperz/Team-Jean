import { redirect } from 'next/navigation'

export default function StudentPage() {
  // Redireciona /student para /student/today automaticamente
  redirect('/student/today')
}
