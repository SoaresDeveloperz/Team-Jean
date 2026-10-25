'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PROFILE_SETUP_MESSAGE,
  ProfileError,
  removeProfileImage,
  saveProfileImage,
  type ProfileImageKind,
} from '@/lib/profile'
import { haptic } from '@/lib/haptics'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'
import { ImageCropper } from './ImageCropper'
import { PhotoActions } from './PhotoActions'

type ProfileImageEditorProps = {
  userId: string
  // O pai guarda o tipo mesmo depois de fechar, para a folha não trocar de
  // conteúdo durante a animação de saída.
  kind: ProfileImageKind
  open: boolean
  currentPath: string | null | undefined
  onClose: () => void
  onChange: (kind: ProfileImageKind, path: string | null) => void
  onUploadingChange?: (kind: ProfileImageKind | null) => void
}

const OUTPUT = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1500, height: 500 },
}

// Fluxo completo da foto/capa: escolher (galeria ou câmera), recortar, enviar
// ou remover. Usado no Perfil do aluno e no painel do treinador.
export function ProfileImageEditor({ userId, kind, open, currentPath, onClose, onChange, onUploadingChange }: ProfileImageEditorProps) {
  const [supabase] = useState(() => createClient())
  const toast = useToast()
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const closeCropper = useCallback(() => setCropOpen(false), [])
  const cover = kind === 'cover'

  const pick = (file: File) => {
    onClose()
    setCropFile(file)
    setCropOpen(true)
  }

  // O recortador mostra o erro se o envio falhar.
  const save = async (image: Blob) => {
    onUploadingChange?.(kind)
    try {
      const path = await saveProfileImage(supabase, userId, kind, image, currentPath)
      onChange(kind, path)
      setCropOpen(false)
      haptic([10, 30, 10])
      toast({ tone: 'success', title: cover ? 'Capa atualizada' : 'Foto atualizada' })
    } catch (error) {
      if (error instanceof ProfileError && error.missing) throw new Error(PROFILE_SETUP_MESSAGE)
      throw error
    } finally {
      onUploadingChange?.(null)
    }
  }

  const remove = async () => {
    onClose()
    onUploadingChange?.(kind)
    try {
      await removeProfileImage(supabase, userId, kind, currentPath)
      onChange(kind, null)
      toast({ tone: 'success', title: cover ? 'Capa removida' : 'Foto removida' })
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Não foi possível remover',
        description:
          error instanceof ProfileError && error.missing ? PROFILE_SETUP_MESSAGE : friendlyError(error),
      })
    } finally {
      onUploadingChange?.(null)
    }
  }

  return (
    <>
      <PhotoActions
        open={open}
        title={cover ? 'Capa do perfil' : 'Foto de perfil'}
        hasPhoto={Boolean(currentPath)}
        camera={cover ? 'environment' : 'user'}
        removeLabel={cover ? 'Remover capa' : 'Remover foto'}
        onClose={onClose}
        onPick={pick}
        onRemove={remove}
      />
      <ImageCropper
        open={cropOpen}
        file={cropFile}
        title={cover ? 'Ajustar capa' : 'Ajustar foto'}
        aspect={cover ? 3 : 1}
        shape={cover ? 'rect' : 'circle'}
        output={OUTPUT[kind]}
        onCancel={closeCropper}
        onConfirm={save}
      />
    </>
  )
}
