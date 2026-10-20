// Ajudantes de texto em português.

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
