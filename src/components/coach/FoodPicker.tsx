'use client'

import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/lib/errors'
import { formatNutrient, searchFoods, type Food } from '@/lib/nutrition'
import { FOOD_COLUMNS, toFood } from '@/lib/nutrition-plan'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'

const inputClassName =
  'w-full rounded-2xl border border-line-strong bg-black/40 p-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand focus:outline-none'
const labelClassName = 'mb-1.5 block text-xs font-black uppercase tracking-[0.1em] text-zinc-400'
const primaryButton = 'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black uppercase tracking-wider text-black disabled:opacity-60'

// Aceita "12,5" e "12.5"; vazio ou inválido vira null.
const toNumber = (text: string) => {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

const summary = (food: Food) =>
  food.kcal === null
    ? 'Sem calorias na tabela'
    : `${formatNutrient('kcal', food.kcal)} kcal · P ${formatNutrient('protein_g', food.protein_g ?? 0)} · C ${formatNutrient('carb_g', food.carb_g ?? 0)} · G ${formatNutrient('fat_g', food.fat_g ?? 0)} (100 g)`

type Props = {
  open: boolean
  onClose: () => void
  foods: Food[]
  // Chamado com o alimento, as gramas e a medida caseira em texto (opcional).
  onPick: (food: Food, grams: number, portionText: string | null) => Promise<void> | void
  onFoodCreated: (food: Food) => void
}

// Busca um alimento (TACO e os cadastrados pelo treinador), ou cadastra à mão o que faltar.
export function FoodPicker({ open, onClose, foods, onPick, onFoodCreated }: Props) {
  const [supabase] = useState(() => createClient())
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)
  const [grams, setGrams] = useState('100')
  const [portion, setPortion] = useState('')
  const [draft, setDraft] = useState({ name: '', kcal: '', protein: '', carb: '', fat: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const results = searchFoods(foods, query)

  const reset = () => {
    setQuery('')
    setChosen(null)
    setCreating(false)
    setGrams('100')
    setPortion('')
    setDraft({ name: '', kcal: '', protein: '', carb: '', fat: '' })
    setError('')
  }
  const close = () => {
    reset()
    onClose()
  }

  const add = async () => {
    const amount = toNumber(grams)
    if (!chosen || amount === null || amount <= 0 || amount > 5000) {
      setError('Informe as gramas, entre 1 e 5000.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPick(chosen, amount, portion.trim() || null)
      close()
    } catch (pickError) {
      setError(friendlyError(pickError, 'Não foi possível adicionar'))
    } finally {
      setBusy(false)
    }
  }

  const createFood = async () => {
    const kcal = toNumber(draft.kcal)
    const protein = toNumber(draft.protein)
    const carb = toNumber(draft.carb)
    const fat = toNumber(draft.fat)
    if (draft.name.trim().length < 2 || kcal === null || protein === null || carb === null || fat === null) {
      setError('Preencha o nome e os valores por 100 g (pode ser 0).')
      return
    }
    setBusy(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('foods')
      .insert({ name: draft.name.trim(), group_name: 'Cadastrado pelo treinador', kcal, protein_g: protein, carb_g: carb, fat_g: fat })
      .select(FOOD_COLUMNS)
      .single()
    setBusy(false)
    if (insertError || !data) {
      setError(friendlyError(insertError, 'Não foi possível cadastrar o alimento'))
      return
    }
    const food = toFood(data)
    onFoodCreated(food)
    setCreating(false)
    setChosen(food)
  }

  const title = chosen ? 'Quanto vai comer?' : creating ? 'Cadastrar alimento' : 'Adicionar alimento'

  return (
    <Modal open={open} onClose={close} title={title} description={chosen ? chosen.name : creating ? 'Valores por 100 g, como no rótulo' : 'Tabela TACO e os seus alimentos'}>
      {error && <Alert variant="error" className="mb-3">{error}</Alert>}

      {chosen ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">{summary(chosen)}</p>
          <div>
            <label htmlFor="food-grams" className={labelClassName}>Gramas</label>
            <input id="food-grams" type="text" inputMode="decimal" value={grams} onChange={(event) => setGrams(event.target.value)} className={inputClassName} />
          </div>
          <div>
            <label htmlFor="food-portion" className={labelClassName}>Medida caseira (opcional)</label>
            <input
              id="food-portion"
              type="text"
              maxLength={60}
              value={portion}
              onChange={(event) => setPortion(event.target.value)}
              placeholder="Ex.: 4 colheres de servir, 2 unidades"
              className={inputClassName}
            />
            <p className="mt-1.5 text-xs text-zinc-500">O aluno vê a medida primeiro e as gramas depois.</p>
          </div>
          <button type="button" onClick={add} disabled={busy} className={primaryButton}>
            {busy ? 'Adicionando...' : 'Adicionar à refeição'}
          </button>
          <button type="button" onClick={() => setChosen(null)} className="flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Escolher outro alimento
          </button>
        </div>
      ) : creating ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="new-food-name" className={labelClassName}>Nome</label>
            <input id="new-food-name" type="text" maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Leite de vaca, integral" className={inputClassName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['kcal', 'Calorias (kcal)'],
                ['protein', 'Proteína (g)'],
                ['carb', 'Carboidrato (g)'],
                ['fat', 'Gordura (g)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`new-food-${key}`} className={labelClassName}>{label}</label>
                <input id={`new-food-${key}`} type="text" inputMode="decimal" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className={inputClassName} />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">Depois que o alimento entra num plano, os valores não mudam mais. Para corrigir, cadastre um novo.</p>
          <button type="button" onClick={createFood} disabled={busy} className={primaryButton}>
            {busy ? 'Salvando...' : 'Cadastrar e escolher'}
          </button>
          <button type="button" onClick={() => setCreating(false)} className="flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para a busca
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar: arroz, frango, banana..."
            aria-label="Buscar alimento"
            className={inputClassName}
          />
          {query.trim() !== '' && results.length === 0 && <p className="py-3 text-center text-xs text-zinc-500">Nenhum alimento com esse nome.</p>}
          {results.length > 0 && (
            <ul className="overflow-hidden rounded-2xl border border-line">
              {results.map((food) => (
                <li key={food.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => setChosen(food)} className="block min-h-11 w-full px-4 py-3 text-left transition hover:bg-white/[0.03]">
                    <span className="block text-sm font-semibold text-white">{food.name}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{summary(food)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length === 30 && <p className="text-xs text-zinc-500">Mostrando os 30 primeiros. Escreva mais para filtrar.</p>}
          <button
            type="button"
            onClick={() => {
              setDraft({ ...draft, name: query.trim() })
              setCreating(true)
            }}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-xs font-bold text-zinc-300 hover:text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Não achou? Cadastrar alimento
          </button>
        </div>
      )}
    </Modal>
  )
}
