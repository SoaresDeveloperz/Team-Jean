'use client'

import { useState } from 'react'
import { Camera, Images, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Modal } from '@/components/ui/modal'

const MAX_FILE_BYTES = 25 * 1024 * 1024

type PhotoActionsProps = {
  open: boolean
  title: string
  hasPhoto: boolean
  // Câmera frontal para a foto de perfil, traseira para a capa.
  camera: 'user' | 'environment'
  removeLabel: string
  onClose: () => void
  onPick: (file: File) => void
  onRemove: () => void
}

const optionClassName =
  'flex h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left text-sm font-bold text-white transition hover:border-line-strong has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand'

// Folha de ações da foto: galeria, câmera ou remover.
export function PhotoActions({ open, title, hasPhoto, camera, removeLabel, onClose, onPick, onRemove }: PhotoActionsProps) {
  const [error, setError] = useState('')

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Escolha uma imagem (JPG, PNG ou HEIC).')
    if (file.size > MAX_FILE_BYTES) return setError('Foto grande demais (máximo de 25 MB).')
    setError('')
    onPick(file)
  }

  const close = () => {
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={title}>
      <div className="space-y-2">
        <label className={optionClassName}>
          <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
          <Images className="h-5 w-5 text-brand" aria-hidden="true" /> Escolher da galeria
        </label>
        <label className={optionClassName}>
          <input type="file" accept="image/*" capture={camera} onChange={handleFile} className="sr-only" />
          <Camera className="h-5 w-5 text-brand" aria-hidden="true" /> Tirar foto agora
        </label>
        {hasPhoto && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-14 w-full items-center gap-3 rounded-2xl border border-danger/25 bg-danger-soft px-4 text-left text-sm font-bold text-danger transition hover:border-danger/50"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" /> {removeLabel}
          </button>
        )}
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Modal>
  )
}
