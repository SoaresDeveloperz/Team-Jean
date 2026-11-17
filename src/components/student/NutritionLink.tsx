'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { forgetNutritionCopy, readNutritionCopy } from '@/lib/nutrition-plan'

// Só quem tem plano montado pelo nutricionista vê o atalho da alimentação.
// Com a cópia do plano no aparelho já aparece na hora (e também sem internet).
export function useHasNutritionPlan(userId: string | null): boolean {
  const [supabase] = useState(() => createClient())
  const [visible, setVisible] = useState(() => (userId ? readNutritionCopy(userId) !== null : false))

  useEffect(() => {
    if (!userId) return
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

  return userId ? visible : false
}
