import { getPreferences } from './preferences'

// Vibração curta de confirmação (Android; o iOS ignora). Respeita a
// preferência "Vibração" do perfil.
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  if (!getPreferences().haptics) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Alguns navegadores bloqueiam vibração sem interação recente.
  }
}
