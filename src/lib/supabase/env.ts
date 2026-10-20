// As variáveis NEXT_PUBLIC_* precisam ser lidas de forma literal para o
// Next.js conseguir embuti-las no bundle do navegador.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        '(arquivo .env.local em desenvolvimento ou painel de variáveis da Vercel em produção).',
    )
  }

  return { url, anonKey }
}
