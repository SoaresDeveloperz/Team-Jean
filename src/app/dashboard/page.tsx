import { redirect } from 'next/navigation'

// Rota antiga: o painel agora fica em /admin (treinador) e /student/week (aluno).
export default function DashboardPage() {
  redirect('/')
}
