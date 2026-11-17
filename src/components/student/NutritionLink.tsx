'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { forgetNutritionCopy, readNutritionCopy } from '@/lib/nutrition-plan'

// "Ver minha alimentação": só aparece para quem tem plano montado pelo nutricionista.
// Com a cópia do plano no aparelho já aparece na hora (e também sem internet).
export function NutritionLink({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient())
  const [visible, setVisible] = useState(() => readNutritionCopy(userId) !== null)

  useEffect(() => {
    let active = true
    void supabase
      .from('nutrition_plans')
      .select('id')
      .eq('student_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Sem internet ou sem o SQL: fica como estava (só a cópia do aparelho decide).
        if (!active || error) return
        setVisible(Boolean(data))
        if (!data) forgetNutritionCopy(userId)
      })
    return () => {
      active = false
    }
  }, [supabase, userId])

  if (!visible) return null
  return (
    <Link href="/student/nutrition" className="-ml-1 mt-1 inline-flex min-h-11 items-center px-1 text-sm font-bold text-brand hover:text-white">
      Ver minha alimentação
    </Link>
  )
}
