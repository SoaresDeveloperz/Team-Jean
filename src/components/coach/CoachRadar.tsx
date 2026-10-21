'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { BatteryWarning, Check, LoaderCircle, MessageSquareText, Radar as RadarIcon, Send, TrendingUp, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { applyProgression, loadRadar, type Radar, type RadarProgression } from '@/lib/coach-insights'
import { loadFeedback, type FeedbackItem } from '@/lib/coach-feedback'
import { notifyStudents } from '@/lib/coach'
import { FeedbackCard } from './FeedbackCard'
import { avatarUrlOf } from '@/lib/profile'
import { formatKg } from '@/lib/workouts'
import { relativeDay } from '@/lib/stats'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { Eyebrow, Tile } from '@/components/ui/tile'

type RadarTab = 'feedback' | 'records' | 'progressions' | 'alerts'
type ListTab = Exclude<RadarTab, 'feedback'>
type Item = {
  key: string
  studentId: string
  title: string
  detail: string
  when?: string
  action: { label: string; tone: 'gold' | 'brand' | 'danger'; title: string; message: string }
  // Progressão: o botão grava a nova carga no treino antes de avisar.
  progression?: RadarProgression
}

const SENT_KEY = 'tj:radar-enviados'
const SENT_DAYS = 21

function readSent() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number>
    const limit = Date.now() - SENT_DAYS * 86_400_000
    return new Set(Object.entries(raw).filter(([, at]) => at > limit).map(([key]) => key))
  } catch {
    return new Set<string>()
  }
}

function rememberSent(key: string) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number>
    raw[key] = Date.now()
    window.localStorage.setItem(SENT_KEY, JSON.stringify(raw))
  } catch {
    // Sem armazenamento: o aviso foi enviado do mesmo jeito.
  }
}

function itemsFrom(radar: Radar): Record<ListTab, Item[]> {
  return {
    records: radar.records.map((record) => ({
      key: record.key,
      studentId: record.studentId,
      title: `${record.studentName} · ${record.exercise}`,
      detail: `${formatKg(record.weight)} kg × ${record.reps} (antes ${formatKg(record.previous)} kg)`,
      when: relativeDay(record.date),
      action: {
        label: 'Parabenizar',
        tone: 'gold',
        title: 'Novo recorde! 🏆',
        message: `${record.exercise}: ${formatKg(record.weight)} kg × ${record.reps}. Mandou muito, ${record.studentName}!`,
      },
    })),
    progressions: radar.progressions.map((item) => ({
      key: item.key,
      studentId: item.studentId,
      title: `${item.studentName} · ${item.exercise}`,
      detail: `Fechou ${item.sets}×${item.reps} com ${formatKg(item.weight)} kg → ${formatKg(item.next)} kg`,
      progression: item.prescriptions.length > 0 ? item : undefined,
      action:
        item.prescriptions.length > 0
          ? {
              label: `Aplicar ${formatKg(item.next)} kg`,
              tone: 'brand',
              title: 'Carga nova no seu treino 📈',
              message: `${item.exercise}: você fechou ${item.sets}×${item.reps} com ${formatKg(item.weight)} kg. A carga-alvo agora é ${formatKg(item.next)} kg e já está no seu treino.`,
            }
          : {
              label: 'Avisar',
              tone: 'brand',
              title: 'Hora de subir a carga 📈',
              message: `${item.exercise}: você fechou ${item.sets}×${item.reps} com ${formatKg(item.weight)} kg. No próximo treino, tente ${formatKg(item.next)} kg.`,
            },
    })),
    alerts: radar.alerts.map((alert) => ({
      key: alert.key,
      studentId: alert.studentId,
      title: alert.studentName,
      detail: `RPE ${alert.rpe.join(' · ')} nos últimos 3 treinos`,
      action: {
        label: 'Sugerir pausa',
        tone: 'danger',
        title: 'Recuperação em foco 🧘',
        message: `Seus últimos treinos foram bem intensos (RPE ${alert.rpe.join(', ')}). Capriche no sono e na alimentação; se precisar, a gente ajusta as cargas.`,
      },
    })),
  }
}

const EMPTY: Record<RadarTab, string> = {
  feedback: 'Nenhum recado dos alunos nos últimos 14 dias.',
  records: 'Nenhum recorde novo nos últimos 7 dias.',
  progressions: 'Ninguém fechou todas as séries no topo da faixa ainda.',
  alerts: 'Ninguém com RPE 9+ nos últimos 3 treinos. 👌',
}

const TONES = {
  gold: 'bg-gold text-black',
  brand: 'bg-brand text-black',
  danger: 'bg-danger-soft text-danger border border-danger/30',
}

// Radar do treinador no painel: o que merece uma mensagem agora.
export function CoachRadar({ students }: { students: Profile[] }) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const tabsId = useId()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [radar, setRadar] = useState<Record<ListTab, Item[]> | null>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<RadarTab>('records')
  const [sent, setSent] = useState<Set<string>>(() => new Set())
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [data, inbox] = await Promise.all([loadRadar(supabase, students), loadFeedback(supabase, students).catch(() => [])])
        if (!active) return
        const items = itemsFrom(data)
        setRadar(items)
        setFeedback(inbox)
        setSent(readSent())
        // Link do push (?radar=recados) abre nos recados; senão, na aba com mais coisa para fazer.
        const fromPush = new URLSearchParams(window.location.search).get('radar') === 'recados'
        const unanswered = inbox.some((item) => !item.reply)
        const firstWithItems = fromPush || unanswered ? 'feedback' : (['records', 'progressions', 'alerts'] as ListTab[]).find((key) => items[key].length > 0)
        if (firstWithItems) setTab(firstWithItems)
        if (fromPush) sectionRef.current?.scrollIntoView({ block: 'start' })
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível montar o radar.')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [supabase, students])

  const studentById = new Map(students.map((student) => [student.id, student]))

  const send = async (item: Item) => {
    setSending(item.key)
    try {
      const student = studentById.get(item.studentId)
      if (item.progression) {
        const updated = await applyProgression(supabase, item.progression)
        if (updated === 0) throw new Error('O exercício não está mais nos treinos ativos do aluno.')
      }
      await notifyStudents(supabase, [item.studentId], item.action.title, item.action.message)
      rememberSent(item.key)
      setSent((current) => new Set(current).add(item.key))
      toast({
        tone: 'success',
        title: item.progression ? 'Carga aplicada no treino' : 'Mensagem enviada',
        description: item.progression
          ? `${student?.full_name ?? 'O aluno'} já vê ${formatKg(item.progression.next)} kg como meta e foi avisado.`
          : `${student?.full_name ?? 'Aluno'} vai ver no sino de avisos.`,
      })
    } catch (sendError) {
      toast({ tone: 'error', title: 'Não foi possível enviar', description: sendError instanceof Error ? sendError.message : undefined })
    } finally {
      setSending(null)
    }
  }

  const tabs: TabItem<RadarTab>[] = [
    { value: 'feedback', label: 'Recados', icon: MessageSquareText, badge: feedback.filter((item) => !item.reply).length },
    { value: 'records', label: 'Recordes', icon: Trophy, badge: radar?.records.filter((item) => !sent.has(item.key)).length },
    { value: 'progressions', label: 'Progressão', icon: TrendingUp, badge: radar?.progressions.filter((item) => !sent.has(item.key)).length },
    { value: 'alerts', label: 'Cansaço', icon: BatteryWarning, badge: radar?.alerts.filter((item) => !sent.has(item.key)).length },
  ]
  const items = tab === 'feedback' ? [] : radar?.[tab] ?? []

  return (
    <Tile className="scroll-mt-24 p-0">
      <div ref={sectionRef} className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>
              <Eyebrow icon={RadarIcon} className="text-brand/90">
                Radar do treinador
              </Eyebrow>
            </h2>
            <p className="mt-1.5 text-xs text-zinc-400">O que merece uma mensagem sua agora.</p>
          </div>
          <m.span
            aria-hidden="true"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand/30"
            animate={{ boxShadow: ['0 0 0 0 rgba(52,211,153,0.35)', '0 0 0 10px rgba(52,211,153,0)'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          >
            <RadarIcon className="h-4 w-4 text-brand" />
          </m.span>
        </div>
        <Tabs id={tabsId} items={tabs} value={tab} onChange={setTab} label="Tipos de alerta" className="mt-4" />
      </div>

      <div className="px-5 pb-5">
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : !radar ? (
          <div className="space-y-2" role="status" aria-label="Montando o radar">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={tab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <TabPanel tabsId={tabsId} value={tab}>
                {tab === 'feedback' ? (
                  feedback.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">{EMPTY.feedback}</p>
                  ) : (
                    <ul className="space-y-2">
                      {feedback.slice(0, 8).map((item) => (
                        <li key={item.sessionId}>
                          <FeedbackCard
                            item={item}
                            student={studentById.get(item.studentId)}
                            onReplied={(replied) =>
                              setFeedback((current) => current.map((entry) => (entry.sessionId === replied.sessionId ? replied : entry)))
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )
                ) : items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-xs text-zinc-500">{EMPTY[tab]}</p>
                ) : (
                  <ul className="space-y-2">
                    {items.slice(0, 6).map((item, index) => {
                      const student = studentById.get(item.studentId)
                      const done = sent.has(item.key)
                      return (
                        <m.li
                          key={item.key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5"
                        >
                          <Link href={`/admin/students?aluno=${item.studentId}`} className="shrink-0 rounded-2xl">
                            <Avatar name={student?.full_name ?? student?.email} seed={item.studentId} src={avatarUrlOf(student)} size="sm" />
                            <span className="sr-only">Abrir a ficha de {student?.full_name ?? 'aluno'}</span>
                          </Link>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold leading-snug text-white">{item.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">
                              {item.detail}
                              {item.when && <span className="text-zinc-500"> · {item.when}</span>}
                            </span>
                          </span>
                          <AnimatePresence mode="wait" initial={false}>
                            {done ? (
                              <m.span
                                key="done"
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[11px] font-bold text-brand"
                              >
                                <Check className="h-4 w-4" aria-hidden="true" /> Enviado
                              </m.span>
                            ) : (
                              <m.button
                                key="send"
                                type="button"
                                whileTap={{ scale: 0.94 }}
                                onClick={() => send(item)}
                                disabled={sending !== null}
                                className={cn(
                                  'flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black disabled:opacity-60',
                                  TONES[item.action.tone],
                                )}
                              >
                                {sending === item.key ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {item.action.label}
                                <span className="sr-only"> {student?.full_name ?? ''}</span>
                              </m.button>
                            )}
                          </AnimatePresence>
                        </m.li>
                      )
                    })}
                  </ul>
                )}
              </TabPanel>
            </m.div>
          </AnimatePresence>
        )}
      </div>
    </Tile>
  )
}
